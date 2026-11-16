import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class merge so component overrides actually win. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
