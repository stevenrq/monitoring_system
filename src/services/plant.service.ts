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
  resetDeviceAlertThresholds,
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
  await refreshDeviceAlertThresholds(saved.deviceId);
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
  const previousDeviceId = (plant.deviceId || DEFAULT_DEVICE_ID).trim();

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

  if (updateData.deviceId !== undefined) {
    const normalizedDeviceId = updateData.deviceId.trim();
    plant.deviceId = normalizedDeviceId || DEFAULT_DEVICE_ID;
  } else {
    plant.deviceId = (plant.deviceId || DEFAULT_DEVICE_ID).trim();
  }

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

  await refreshDeviceAlertThresholds(saved.deviceId);

  if (previousDeviceId !== saved.deviceId) {
    await refreshDeviceAlertThresholds(previousDeviceId);
  }
  return saved;
};

export const deletePlant = async (
  plantId: string
): Promise<IPlantDocument | null> => {
  const plant = await Plant.findByIdAndDelete(plantId);
  if (plant) {
    await refreshDeviceAlertThresholds(plant.deviceId);
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

  const deviceIds = await Plant.distinct("deviceId");
  const normalizedIds = new Set<string>();

  for (const deviceId of deviceIds as Array<string | undefined | null>) {
    const normalized =
      (typeof deviceId === "string" && deviceId.trim()) || DEFAULT_DEVICE_ID;
    normalizedIds.add(normalized);
  }

  if (!normalizedIds.size) {
    await refreshDeviceAlertThresholds(DEFAULT_DEVICE_ID);
    return;
  }

  for (const deviceId of normalizedIds) {
    await refreshDeviceAlertThresholds(deviceId);
  }
};

export async function refreshDeviceAlertThresholds(
  deviceId?: string
): Promise<void> {
  const normalizedDeviceId = (deviceId || DEFAULT_DEVICE_ID).trim();

  if (!ALERT_ENABLED_DEVICE_IDS.has(normalizedDeviceId)) {
    return;
  }

  const plants = await Plant.find({ deviceId: normalizedDeviceId })
    .sort({ updatedAt: 1, createdAt: 1 })
    .exec();

  clearDeviceThresholds(normalizedDeviceId);

  if (!plants.length) {
    return;
  }

  for (const plant of plants) {
    await applyPlantThresholds(plant);
  }
}

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

  resetDeviceAlertThresholds(normalizedDeviceId);
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
