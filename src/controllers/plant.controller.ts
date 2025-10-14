import * as plantService from "../services/plant.service";
import { Request, Response } from "express";

export const createPlant = async (req: Request, res: Response) => {
  try {
    const newPlant = await plantService.createPlant(req.body);
    res.status(201).json(newPlant);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Error desconocido" });
    }
  }
};

export const getAllPlants = async (req: Request, res: Response) => {
  try {
    const plants = await plantService.getAllPlants();
    res.status(200).json(plants);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error desconocido" });
    }
  }
};

export const getPlantById = async (req: Request, res: Response) => {
  try {
    const plant = await plantService.getPlantById(req.params.id);
    if (!plant) {
      return res.status(404).json({ message: "Planta no encontrada" });
    }
    res.status(200).json(plant);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error desconocido" });
    }
  }
};

export const updatePlant = async (req: Request, res: Response) => {
  try {
    const plant = await plantService.updatePlant(req.params.id, req.body);
    if (!plant) {
      return res.status(404).json({ message: "Planta no encontrada" });
    }
    res.status(200).json({ message: "Planta actualizada exitosamente", plant });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Error desconocido" });
    }
  }
};

export const deletePlant = async (req: Request, res: Response) => {
  try {
    const plant = await plantService.deletePlant(req.params.id);
    if (!plant) {
      return res.status(404).json({ message: "Planta no encontrada" });
    }
    res.status(200).json({ message: "Planta eliminada exitosamente" });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error desconocido" });
    }
  }
};

export const getPlantCount = async (req: Request, res: Response) => {
  try {
    const count = await plantService.getPlantCount();
    res.status(200).json({ count });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error desconocido" });
    }
  }
};
