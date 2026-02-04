type ClassValue = string | undefined | null | false

export const cn = (...inputs: ClassValue[]) => inputs.filter(Boolean).join(' ')
