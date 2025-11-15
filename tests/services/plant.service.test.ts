import { Types } from "mongoose";
import { SENSOR_TYPES } from "../../src/constants/sensor-types";
import * as plantService from "../../src/services/plant.service";
import {
  ALERT_ENABLED_DEVICE_IDS,
  getAlertThreshold,
  setAlertThreshold,
} from "../../src/services/notification.service";
import Plant from "../../src/models/plant.model";
import type { IPlant } from "../../src/interfaces/plant.interface";
import type { IPlantDocument } from "../../src/interfaces/plant.interface";

const { deletePlant, refreshDeviceAlertThresholds, updatePlant } =
  plantService;

const SAMPLE_THRESHOLDS = {
  temperature: { min: 15, max: 28 },
  humidity: { min: 40, max: 70 },
  soil_humidity: { min: 20 },
  solar_radiation: { max: 900 },
};

type FindQueryMock<T> = {
  sort: jest.Mock<{ exec: () => Promise<T[]> }, [Record<string, number>]>;
};

function mockFindQuery<T extends IPlant>(
  spy: jest.SpyInstance,
  docs: T[],
): FindQueryMock<T> {
  const exec = jest.fn().mockResolvedValue(docs);
  const sort = jest.fn().mockReturnValue({ exec });
  spy.mockReturnValueOnce({ sort } as FindQueryMock<T>);
  return { sort };
}

function createPlantDocument(
  overrides: Partial<IPlantDocument> = {},
): IPlantDocument & { save: jest.Mock } {
  const baseThresholds = JSON.parse(JSON.stringify(SAMPLE_THRESHOLDS));
  const document = {
    _id: overrides._id || new Types.ObjectId(),
    name: overrides.name || "Lavanda",
    deviceId: overrides.deviceId || "ESP32_1",
    thresholds: overrides.thresholds || baseThresholds,
    save: jest.fn().mockResolvedValue(null),
  } as IPlantDocument & { save: jest.Mock };
  document.save.mockImplementation(async () => document);
  return document;
}

describe("plant.service thresholds sync", () => {
  let findSpy: jest.SpyInstance;

  beforeEach(() => {
    findSpy = jest.spyOn(Plant, "find");
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    for (const sensor of SENSOR_TYPES) {
      setAlertThreshold("ESP32_1", sensor, {});
    }
  });

  it("applies the latest thresholds for the given device", async () => {
    const plantDoc: IPlant & {
      _id: Types.ObjectId;
    } = {
      _id: new Types.ObjectId("507f1f77bcf86cd799439011"),
      name: "Lavanda",
      deviceId: "ESP32_1",
      thresholds: {
        temperature: { min: 15, max: 28 },
        humidity: { min: 40, max: 70 },
        soil_humidity: { min: 20 },
        solar_radiation: { max: 900 },
      },
    };

    const query = mockFindQuery(findSpy, [plantDoc]);

    await refreshDeviceAlertThresholds("ESP32_1");

    expect(Plant.find).toHaveBeenCalledWith({ deviceId: "ESP32_1" });
    expect(query.sort).toHaveBeenCalledWith({ updatedAt: 1, createdAt: 1 });

    const config = getAlertThreshold("ESP32_1", "temperature");
    expect(config?.thresholds).toEqual({ min: 15, max: 28 });
    expect(config?.plantName).toBe("Lavanda");
    expect(config?.plantId).toBe(plantDoc._id.toString());

    const soilConfig = getAlertThreshold("ESP32_1", "soil_humidity");
    expect(soilConfig?.thresholds).toEqual({ min: 20 });
  });

  it("clears thresholds when there are no plants for the device", async () => {
    const plantDoc: IPlant = {
      name: "Lavanda",
      deviceId: "ESP32_1",
      thresholds: {
        temperature: { min: 12, max: 30 },
        humidity: { min: 30, max: 60 },
        soil_humidity: { min: 20 },
        solar_radiation: { max: 950 },
      },
    };

    mockFindQuery(findSpy, [plantDoc]);
    await refreshDeviceAlertThresholds("ESP32_1");

    mockFindQuery(findSpy, []);
    await refreshDeviceAlertThresholds("ESP32_1");

    expect(getAlertThreshold("ESP32_1", "temperature")).toBeUndefined();
  });

  it("re-syncs thresholds after deleting the last plant of a device", async () => {
    const plantDoc: IPlant & {
      _id: Types.ObjectId;
    } = {
      _id: new Types.ObjectId("657f1f77bcf86cd799439012"),
      name: "Tomillo",
      deviceId: "ESP32_1",
      thresholds: {
        temperature: { min: 10, max: 26 },
        humidity: { min: 35, max: 65 },
        soil_humidity: { min: 20 },
        solar_radiation: { max: 800 },
      },
    };

    mockFindQuery(findSpy, [plantDoc]);
    await refreshDeviceAlertThresholds("ESP32_1");

    const deleteSpy = jest
      .spyOn(Plant, "findByIdAndDelete")
      .mockResolvedValueOnce(plantDoc as never);

    mockFindQuery(findSpy, []);

    const deleted = await deletePlant("dead-beef");
    expect(deleted?.name).toBe("Tomillo");
    expect(deleteSpy).toHaveBeenCalledWith("dead-beef");

    expect(getAlertThreshold("ESP32_1", "temperature")).toBeUndefined();
  });
});

describe("plant.service updatePlant device handling", () => {
  beforeAll(() => {
    ALERT_ENABLED_DEVICE_IDS.add("ESP32_2");
    ALERT_ENABLED_DEVICE_IDS.add("ESP32_3");
  });

  afterAll(() => {
    ALERT_ENABLED_DEVICE_IDS.delete("ESP32_2");
    ALERT_ENABLED_DEVICE_IDS.delete("ESP32_3");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mantiene el dispositivo actual si no se envía deviceId", async () => {
    const plantDoc = createPlantDocument({ deviceId: "ESP32_2" });
    jest.spyOn(Plant, "findById").mockResolvedValueOnce(plantDoc as never);
    const findSpy = jest.spyOn(Plant, "find");
    mockFindQuery(findSpy, [plantDoc as unknown as IPlant]);

    const result = await updatePlant(
      (plantDoc._id as Types.ObjectId).toString(),
      {
        thresholds: { temperature: { min: 18 } },
      },
    );

    expect(result?.deviceId).toBe("ESP32_2");
    expect(findSpy).toHaveBeenCalledWith({ deviceId: "ESP32_2" });
  });

  it("actualiza el deviceId cuando se proporciona uno nuevo", async () => {
    const plantDoc = createPlantDocument({ deviceId: "ESP32_1" });
    jest.spyOn(Plant, "findById").mockResolvedValueOnce(plantDoc as never);
    const findSpy = jest.spyOn(Plant, "find");
    mockFindQuery(findSpy, [{ ...plantDoc, deviceId: "ESP32_3" } as IPlant]);
    mockFindQuery(findSpy, []);

    const result = await updatePlant(
      (plantDoc._id as Types.ObjectId).toString(),
      {
        deviceId: "ESP32_3",
        thresholds: { humidity: { max: 75 } },
      },
    );

    expect(result?.deviceId).toBe("ESP32_3");
    expect(findSpy).toHaveBeenNthCalledWith(1, { deviceId: "ESP32_3" });
    expect(findSpy).toHaveBeenNthCalledWith(2, { deviceId: "ESP32_1" });
  });
});
