import {
  IPlant,
  IPlantDocument,
  PlantThresholds,
  PlantUpdatePayload,
} from "../interfaces/plant.interface";
import { SENSOR_TYPES, SensorType } from "../constants/sensor-types";
import Plant from "../models/plant.model";
import {
  ALERT_ENABLED_DEVICE_IDS,
  setAlertThreshold,
} from "./notification.service";

const DEFAULT_DEVICE_ID = "ESP32_1";
const SOIL_HUMIDITY_SENSOR: SensorType = "soil_humidity";
const SOIL_HUMIDITY_MIN = 20;
const DEVICE_ID_INDEX = "deviceId_1";

export const createPlant = async (
  plantData: IPlant
): Promise<IPlantDocument> => {
  const normalizedName = plantData.name?.trim();
  if (!normalizedName) {
    throw new Error("El nombre de la planta es obligatorio.");
  }

  if (!plantData.thresholds) {
    throw new Error(
      "Debes proporcionar los umbrales de la planta para crearla."
    );
  }

  const existingByName = await Plant.findOne({ name: normalizedName }).collation({
    locale: "es",
    strength: 2,
  });
  if (existingByName) {
    throw new Error(`Ya existe una planta con el nombre "${normalizedName}".`);
  }

  const payload: IPlant = {
    ...plantData,
    name: normalizedName,
    deviceId: (plantData.deviceId || DEFAULT_DEVICE_ID).trim(),
    thresholds: normalizeThresholds(plantData.thresholds),
  };

  const newPlant = new Plant(payload);
  const saved = await newPlant.save();
  await applyPlantThresholds(saved);
  return saved;
};

export const getAllPlants = async (): Promise<IPlantDocument[]> => {
  return Plant.find();
};

export const getPlantById = async (
  plantId: string
): Promise<IPlantDocument | null> => {
  return Plant.findById(plantId);
};

export const updatePlant = async (
  plantId: string,
  updateData: PlantUpdatePayload
): Promise<IPlantDocument | null> => {
  const plant = await Plant.findById(plantId);
  if (!plant) {
    return null;
  }

  if (updateData.name !== undefined) {
    const normalizedName = updateData.name.trim();
    if (!normalizedName) {
      throw new Error("El nombre de la planta no puede estar vacío.");
    }

    const existingByName = await Plant.findOne({
      name: normalizedName,
      _id: { $ne: plant._id },
    }).collation({ locale: "es", strength: 2 });

    if (existingByName) {
      throw new Error(`Ya existe una planta con el nombre "${normalizedName}".`);
    }

    plant.name = normalizedName;
  }

  plant.deviceId = DEFAULT_DEVICE_ID;

  if (updateData.thresholds) {
    for (const sensor of SENSOR_TYPES) {
      const sensorUpdate = updateData.thresholds[sensor];
      if (sensorUpdate) {
        plant.thresholds[sensor] = {
          ...plant.thresholds[sensor],
          ...sensorUpdate,
        };
      }
    }
  }

  plant.thresholds = normalizeThresholds(plant.thresholds);

  const saved = await plant.save();

  await applyPlantThresholds(saved);
  return saved;
};

export const deletePlant = async (
  plantId: string
): Promise<IPlantDocument | null> => {
  const plant = await Plant.findByIdAndDelete(plantId);
  if (plant) {
    const latest = await Plant.find()
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(1);

    if (latest.length) {
      await applyPlantThresholds(latest[0]);
    } else {
      clearDeviceThresholds(DEFAULT_DEVICE_ID);
    }
  }
  return plant;
};

export const getPlantCount = async (): Promise<number | null> => {
  return Plant.countDocuments();
};

export const initializePlantThresholds = async (): Promise<void> => {
  try {
    await Plant.collection.dropIndex(DEVICE_ID_INDEX);
    console.log(`Índice '${DEVICE_ID_INDEX}' eliminado (si existía).`);
  } catch (error) {
    const codeName =
      typeof error === "object" && error && "codeName" in error
        ? (error as { codeName?: string }).codeName
        : undefined;

    if (codeName !== "IndexNotFound") {
      console.warn(
        `No fue posible eliminar el índice '${DEVICE_ID_INDEX}':`,
        error
      );
    }
  }

  const plants = await Plant.find().sort({ updatedAt: 1, createdAt: 1 });
  for (const plant of plants) {
    await applyPlantThresholds(plant);
  }
};

async function applyPlantThresholds(plant: IPlant | IPlantDocument) {
  const deviceId = (plant.deviceId || DEFAULT_DEVICE_ID).trim();

  if (!ALERT_ENABLED_DEVICE_IDS.has(deviceId)) {
    return;
  }

  const association = {
    plantId: getPlantId(plant),
    plantName: plant.name,
  };

  for (const sensor of SENSOR_TYPES) {
    const thresholds = plant.thresholds[sensor];
    if (thresholds) {
      setAlertThreshold(deviceId, sensor, thresholds, association);
    }
  }
}

function clearDeviceThresholds(deviceId: string) {
  const normalizedDeviceId = (deviceId || DEFAULT_DEVICE_ID).trim();

  if (!ALERT_ENABLED_DEVICE_IDS.has(normalizedDeviceId)) {
    return;
  }
  for (const sensor of SENSOR_TYPES) {
    try {
      setAlertThreshold(normalizedDeviceId, sensor, {});
    } catch {
      // ignore errors during cleanup
    }
  }
}

function normalizeThresholds(thresholds?: PlantThresholds): PlantThresholds {
  const normalized = {} as PlantThresholds;

  for (const sensor of SENSOR_TYPES) {
    if (sensor === SOIL_HUMIDITY_SENSOR) {
      normalized[sensor] = { min: SOIL_HUMIDITY_MIN };
      continue;
    }

    const value = thresholds?.[sensor];
    normalized[sensor] = value ? { ...value } : {};
  }

  return normalized;
}

function getPlantId(
  plant: IPlant | IPlantDocument
): string | undefined {
  const document = plant as Partial<IPlantDocument>;
  const rawId = document?._id;
  if (!rawId) {
    return undefined;
  }
  return rawId.toString();
}
