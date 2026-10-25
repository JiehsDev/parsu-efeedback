"use client";
import { createContext } from "react";

export const FormFieldContext = createContext<{
  id: string;
  labelId: string;
  describedBy?: string;
  required: boolean;
  invalid: boolean;
} | null>(null);
