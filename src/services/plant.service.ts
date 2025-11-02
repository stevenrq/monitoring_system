import {
  IPlant,
  IPlantDocument,
  PlantThresholds,
  PlantUpdatePayload,
} from "../interfaces/plant.interface";
import { SENSOR_TYPES } from "../constants/sensor-types";
import Plant from "../models/plant.model";
import {
  ALERT_ENABLED_DEVICE_IDS,
  setAlertThreshold,
} from "./notification.service";

const DEFAULT_DEVICE_ID = "ESP32_1";
const SOIL_HUMIDITY_SENSOR = "soil_humidity";
const SOIL_HUMIDITY_MIN = 20;

export const createPlant = async (
  plantData: IPlant
): Promise<IPlantDocument> => {
  const payload: IPlant = {
    ...plantData,
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
    plant.name = updateData.name;
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
    clearDeviceThresholds(DEFAULT_DEVICE_ID);
  }
  return plant;
};

export const getPlantCount = async (): Promise<number | null> => {
  return Plant.countDocuments();
};

export const initializePlantThresholds = async (): Promise<void> => {
  const plants = await Plant.find();
  for (const plant of plants) {
    await applyPlantThresholds(plant);
  }
};

async function applyPlantThresholds(plant: IPlant | IPlantDocument) {
  const deviceId = (plant.deviceId || DEFAULT_DEVICE_ID).trim();

  if (!ALERT_ENABLED_DEVICE_IDS.has(deviceId)) {
    return;
  }

  for (const sensor of SENSOR_TYPES) {
    const thresholds = plant.thresholds[sensor];
    if (thresholds) {
      setAlertThreshold(deviceId, sensor, thresholds);
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
  const safe: PlantThresholds = {
    ...(thresholds || ({} as PlantThresholds)),
  };

  safe[SOIL_HUMIDITY_SENSOR] = { min: SOIL_HUMIDITY_MIN };

  return safe;
}
