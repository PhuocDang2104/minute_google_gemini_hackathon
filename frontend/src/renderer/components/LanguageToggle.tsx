import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { languageNames, languageFlags, type Language } from '../i18n';

interface LanguageToggleProps {
  variant?: 'icon' | 'button' | 'dropdown';
  className?: string;
}

export function LanguageToggle({ variant = 'dropdown', className = '' }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages: Language[] = ['vi', 'en'];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'icon') {
    return (
      <button
        className={`language-toggle language-toggle--icon ${className}`}
        onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
        title={languageNames[language]}
      >
        <span className="language-toggle__flag">{languageFlags[language]}</span>
      </button>
    );
  }

  if (variant === 'button') {
    return (
      <div className={`language-toggle language-toggle--buttons ${className}`}>
        {languages.map((lang) => (
          <button
            key={lang}
            className={`language-toggle__btn ${language === lang ? 'language-toggle__btn--active' : ''}`}
            onClick={() => setLanguage(lang)}
          >
            <span className="language-toggle__flag">{languageFlags[lang]}</span>
            <span className="language-toggle__name">{languageNames[lang]}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`language-toggle language-toggle--dropdown ${className}`}>
      <button
        className="language-toggle__trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Globe size={18} />
        <span className="language-toggle__current">
          {languageFlags[language]} {languageNames[language]}
        </span>
      </button>
      
      {isOpen && (
        <div className="language-toggle__menu">
          {languages.map((lang) => (
            <button
              key={lang}
              className={`language-toggle__option ${language === lang ? 'language-toggle__option--active' : ''}`}
              onClick={() => {
                setLanguage(lang);
                setIsOpen(false);
              }}
            >
              <span className="language-toggle__flag">{languageFlags[lang]}</span>
              <span className="language-toggle__name">{languageNames[lang]}</span>
              {language === lang && <Check size={16} className="language-toggle__check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

