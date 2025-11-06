import { DateTime } from "luxon";
import {
  getDailyReport,
  getHourlyReport,
  getMonthlyReport,
  upsertHourlyAverages,
} from "../../src/services/reports.service";
import SensorDataModel from "../../src/models/sensor-data.model";
import HourlyAverageModel from "../../src/models/hourly-average.model";

jest.mock("../../src/models/sensor-data.model", () => {
  return {
    __esModule: true,
    default: {
      aggregate: jest.fn(),
    },
  };
});

jest.mock("../../src/models/hourly-average.model", () => {
  return {
    __esModule: true,
    default: {
      bulkWrite: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    },
  };
});

const aggregateMock = SensorDataModel.aggregate as jest.Mock;
const bulkWriteMock = HourlyAverageModel.bulkWrite as jest.Mock;
const findMock = HourlyAverageModel.find as jest.Mock;
const countDocumentsMock = HourlyAverageModel.countDocuments as jest.Mock;
const UTC_ZONE = "utc";
const UTC_TIMEZONE = "UTC";

const buildQueryChain = (results: any[]) => {
  const exec = jest.fn().mockResolvedValue(results);
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec,
  };
  return { chain, exec };
};

describe("reports.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2025-11-02T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("upsertHourlyAverages", () => {
    it("agrupa lecturas y realiza upsert sin duplicados", async () => {
      const hour = DateTime.fromISO("2025-11-02T07:00:00", {
        zone: UTC_ZONE,
      }).toJSDate();

      aggregateMock.mockResolvedValue([
        {
          deviceId: "ESP32_1",
          sensorType: "temperature",
          hour,
          avg: 21.5,
          min: 20.1,
          max: 22.3,
          samples: 12,
          units: "°C",
        },
      ]);

      bulkWriteMock.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });

      const from = new Date("2025-11-02T06:00:00Z");
      const to = new Date("2025-11-02T08:00:00Z");
      const response = await upsertHourlyAverages({
        from,
        to,
        deviceId: "ESP32_1",
        sensorType: "temperature",
      });

      expect(response).toEqual({ upserted: 1 });
      expect(aggregateMock).toHaveBeenCalledTimes(1);
      const pipeline = aggregateMock.mock.calls[0][0];
      expect(pipeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            $addFields: expect.objectContaining({
              hour: expect.objectContaining({
                $dateTrunc: expect.objectContaining({
                  timezone: UTC_TIMEZONE,
                }),
              }),
            }),
          }),
        ])
      );

      expect(bulkWriteMock).toHaveBeenCalledWith(
        [
          {
            updateOne: {
              filter: {
                deviceId: "ESP32_1",
                sensorType: "temperature",
                hour,
              },
              update: expect.objectContaining({
                $set: expect.objectContaining({
                  avg: 21.5,
                  min: 20.1,
                  max: 22.3,
                  samples: 12,
                  units: "°C",
                }),
                $setOnInsert: expect.objectContaining({
                  createdAt: new Date("2025-11-02T12:00:00.000Z"),
                }),
              }),
              upsert: true,
            },
          },
        ],
        { ordered: false }
      );
    });
  });

  describe("getHourlyReport", () => {
    it("retorna métricas horarias paginadas con formato zonificado", async () => {
      const hour = DateTime.fromISO("2025-11-02T09:00:00", {
        zone: UTC_ZONE,
      }).toJSDate();

      const { chain } = buildQueryChain([
        {
          deviceId: "ESP32_1",
          sensorType: "temperature",
          hour,
          avg: 22,
          min: 21,
          max: 23,
          samples: 12,
          units: "°C",
        },
      ]);
      findMock.mockReturnValueOnce(chain);
      countDocumentsMock.mockResolvedValueOnce(1);

      const from = DateTime.fromISO("2025-11-02T09:00:00", {
        zone: UTC_ZONE,
      })
        .minus({ hours: 1 })
        .toJSDate();
      const to = DateTime.fromISO("2025-11-02T09:00:00", {
        zone: UTC_ZONE,
      })
        .plus({ hours: 1 })
        .toJSDate();

      const result = await getHourlyReport({
        deviceId: "ESP32_1",
        sensorType: "temperature",
        from,
        to,
        limit: 10,
        page: 1,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        deviceId: "ESP32_1",
        sensorType: "temperature",
        avg: 22,
        min: 21,
        max: 23,
        samples: 12,
        units: "°C",
      });
      expect(result.data[0].hour).toBe("2025-11-02T09:00:00Z");

      expect(result.pagination).toEqual({
        total: 1,
        limit: 10,
        page: 1,
        pages: 1,
      });
    });
  });

  describe("getDailyReport", () => {
    it("calcula promedios diarios y marca Tmax/Tmin", async () => {
      const base = DateTime.fromISO("2025-11-02T00:00:00", {
        zone: UTC_ZONE,
      });

      const docs = [
        {
          deviceId: "ESP32_1",
          sensorType: "temperature",
          hour: base.toJSDate(),
          avg: 20,
          min: 19,
          max: 21,
          samples: 12,
          units: "°C",
        },
        {
          deviceId: "ESP32_1",
          sensorType: "temperature",
          hour: base.plus({ hours: 1 }).toJSDate(),
          avg: 27,
          min: 26,
          max: 28,
          samples: 12,
          units: "°C",
        },
        {
          deviceId: "ESP32_1",
          sensorType: "temperature",
          hour: base.plus({ hours: 2 }).toJSDate(),
          avg: 18,
          min: 17,
          max: 19,
          samples: 12,
          units: "°C",
        },
        {
          deviceId: "ESP32_1",
          sensorType: "humidity",
          hour: base.toJSDate(),
          avg: 60,
          min: 55,
          max: 65,
          samples: 12,
          units: "%",
        },
        {
          deviceId: "ESP32_1",
          sensorType: "solar_radiation",
          hour: base.toJSDate(),
          avg: 450,
          min: 400,
          max: 500,
          samples: 12,
          units: "W/m²",
        },
        {
          deviceId: "ESP32_1",
          sensorType: "solar_radiation",
          hour: base.plus({ hours: 1 }).toJSDate(),
          avg: 500,
          min: 480,
          max: 520,
          samples: 12,
          units: "W/m²",
        },
      ];

      const { chain } = buildQueryChain(docs);
      findMock.mockReturnValueOnce(chain);

      const report = await getDailyReport("ESP32_1", base.toJSDate());

      expect(report.rows[0]).toMatchObject({
        hour: 0,
        temperature_avg: 20,
        humidity_avg: 60,
        solar_radiation_avg: 450,
      });
      expect(report.rows[0].isTmax).toBeUndefined();
      expect(report.rows[0].isTmin).toBeUndefined();
      expect(report.rows[1]).toMatchObject({
        hour: 1,
        temperature_avg: 27,
        isTmax: true,
      });
      expect(report.rows[2]).toMatchObject({
        hour: 2,
        temperature_avg: 18,
        isTmin: true,
      });

      expect(report.temperature).toEqual({
        tmax: 27,
        tmin: 18,
        tpro: Number(((20 + 27 + 18) / 3).toFixed(2)),
      });
      expect(report.humidity).toEqual({ hpro: 60 });
      expect(report.radiation).toEqual({
        radTot: 950,
        radPro: 475,
        radMax: 500,
      });
    });
  });

  describe("getMonthlyReport", () => {
    it("resume métricas por día", async () => {
      const base = DateTime.fromISO("2025-11-01T00:00:00", {
        zone: UTC_ZONE,
      });

      const docs = [
        {
          deviceId: "ESP32_1",
          sensorType: "temperature",
          hour: base.plus({ hours: 6 }).toJSDate(),
          avg: 22,
          min: 21,
          max: 23,
          samples: 12,
          units: "°C",
        },
        {
          deviceId: "ESP32_1",
          sensorType: "temperature",
          hour: base.plus({ days: 1, hours: 7 }).toJSDate(),
          avg: 25,
          min: 24,
          max: 26,
          samples: 12,
          units: "°C",
        },
        {
          deviceId: "ESP32_1",
          sensorType: "humidity",
          hour: base.plus({ days: 1 }).toJSDate(),
          avg: 70,
          min: 68,
          max: 72,
          samples: 12,
          units: "%",
        },
        {
          deviceId: "ESP32_1",
          sensorType: "solar_radiation",
          hour: base.plus({ days: 1 }).toJSDate(),
          avg: 600,
          min: 500,
          max: 700,
          samples: 12,
          units: "W/m²",
        },
      ];

      const { chain } = buildQueryChain(docs);
      findMock.mockReturnValueOnce(chain);

      const report = await getMonthlyReport("ESP32_1", 2025, 11);

      expect(report.days.find((day) => day.day === 1)).toMatchObject({
        Tmax: 22,
        Tmin: 22,
        Tpro: 22,
      });
      expect(report.days.find((day) => day.day === 2)).toMatchObject({
        Tmax: 25,
        Tmin: 25,
        Tpro: 25,
        HR: 70,
        RadTot: 600,
        RadPro: 600,
        RadMax: 600,
      });
    });
  });
});
