import { Dog, Cat, Bird, PawPrint, Activity, Utensils, AlertTriangle, Thermometer, Droplets, Sparkles, Ambulance, Search, CheckCircle } from 'lucide-react';
import type { AnimalType, ReportCondition, TaskType } from './types';

export const ANIMAL_ICONS: Record<AnimalType, React.ElementType> = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  cow: PawPrint,
  mixed: PawPrint,
};

export const CONDITION_ICONS: Record<ReportCondition, React.ElementType> = {
  injured: Activity,
  hungry: Utensils,
  aggressive: AlertTriangle,
  sick: Thermometer,
};

export const TASK_ICONS: Record<TaskType, React.ElementType> = {
  refill_water: Droplets,
  cleanup: Sparkles,
  rescue: Ambulance,
  inspection: Search,
  feeding: Utensils,
  verification: CheckCircle,
};
