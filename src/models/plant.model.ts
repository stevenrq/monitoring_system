import { model, Schema } from "mongoose";
import {
  IPlantDocument,
  IPlantModel,
  PlantThresholds,
  SensorThreshold,
} from "../interfaces/plant.interface";
import {
  SENSOR_TYPES,
  SENSORS_WITH_OPTIONAL_MIN,
} from "../constants/sensor-types";

const SensorThresholdSchema = new Schema<SensorThreshold>(
  {
    min: { type: Number },
    max: { type: Number },
  },
  { _id: false }
);

const thresholdsDefinition: Record<string, unknown> = {};
for (const sensor of SENSOR_TYPES) {
  const definition: Record<string, unknown> = {
    type: SensorThresholdSchema,
    required: true,
  };

  if (sensor === "soil_humidity") {
    definition.default = { min: 20 };
  }

  thresholdsDefinition[sensor] = definition;
}

export const PlantSchema = new Schema<IPlantDocument, IPlantModel>(
  {
    deviceId: { type: String, trim: true, default: "ESP32_1" },
    name: { type: String, required: true, trim: true },
    thresholds: {
      type: new Schema<PlantThresholds>(thresholdsDefinition, { _id: false }),
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

PlantSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "es", strength: 2 } }
);

function validateThresholds(value: PlantThresholds | undefined) {
  if (!value) {
    throw new Error(
      "Debe proporcionar los umbrales mínimos y/o máximos por cada sensor."
    );
  }

  for (const sensor of SENSOR_TYPES) {
    const thresholds = value[sensor];

    if (!thresholds) {
      throw new Error(`Faltan los umbrales para el sensor ${sensor}.`);
    }

    const hasMin =
      thresholds.min !== undefined && thresholds.min !== null;
    const hasMax =
      thresholds.max !== undefined && thresholds.max !== null;

    if (!hasMin && !hasMax) {
      if (SENSORS_WITH_OPTIONAL_MIN.has(sensor)) {
        throw new Error(
          `Debe definir al menos el umbral máximo para el sensor ${sensor}.`
        );
      }

      throw new Error(
        `Debe definir al menos uno de los umbrales (mínimo o máximo) para el sensor ${sensor}.`
      );
    }

    if (
      hasMin &&
      hasMax &&
      (thresholds.min as number) > (thresholds.max as number)
    ) {
      throw new Error(
        `El umbral mínimo no puede ser mayor al máximo para el sensor ${sensor}.`
      );
    }

    if (
      sensor === "solar_radiation" &&
      hasMin &&
      (thresholds.min as number) <= 0
    ) {
      throw new Error(
        "El umbral mínimo para radiación solar debe ser mayor a 0."
      );
    }
  }
}

PlantSchema.path("thresholds").validate({
  validator: (value: PlantThresholds) => {
    validateThresholds(value);
    return true;
  },
  message: (props) =>
    props.reason instanceof Error
      ? props.reason.message
      : "Umbrales inválidos para la planta.",
});

const Plant = model<IPlantDocument, IPlantModel>("Plant", PlantSchema);

export default Plant;
