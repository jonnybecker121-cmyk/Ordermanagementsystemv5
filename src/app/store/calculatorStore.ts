import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Material {
  id: string;
  name: string;
  ekPrice: number;
  unit: string;
  category?: 'raw' | 'processed';
}

export interface MaterialUsage {
  materialId: string;
  quantity: number;
}

export interface EndProduct {
  id: string;
  name: string;
  materials: MaterialUsage[];
  productionTime: number;
  productionCost: number;
  markup: number;
  markupType: 'percent' | 'fixed';
  vkPrice?: number;
  category?: string;
}

interface CalculatorState {
  materials: Material[];
  endProducts: EndProduct[];
  addMaterial: (material: Omit<Material, 'id'>) => void;
  deleteMaterial: (id: string) => void;
  addEndProduct: (product: Omit<EndProduct, 'id'>) => void;
  deleteEndProduct: (id: string) => void;
}

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set) => ({
      materials: [],
      endProducts: [],
      addMaterial: (material) => set((state) => ({
        materials: [...state.materials, { ...material, id: `mat-${Date.now()}` }]
      })),
      deleteMaterial: (id) => set((state) => ({
        materials: state.materials.filter(m => m.id !== id)
      })),
      addEndProduct: (product) => set((state) => ({
        endProducts: [...state.endProducts, { ...product, id: `prod-${Date.now()}` }]
      })),
      deleteEndProduct: (id) => set((state) => ({
        endProducts: state.endProducts.filter(p => p.id !== id)
      })),
    }),
    {
      name: 'calculator-storage',
    }
  )
);
