import { useLanguage } from '../contexts/LanguageContext'

export const useLocaleText = () => {
  const { language } = useLanguage()
  const isVi = language === 'vi'

  const lt = (vi: string, en: string): string => (isVi ? vi : en)

  const dateLocale = isVi ? 'vi-VN' : 'en-US'
  const timeLocale = isVi ? 'vi-VN' : 'en-US'

  return {
    language,
    isVi,
    lt,
    dateLocale,
    timeLocale,
  }
}

