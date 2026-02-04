import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

type NavItem = {
  name: string
  to?: string
  icon?: React.ReactNode
  onClick?: () => void
}

type NavAction = {
  label: string
  to: string
  icon?: React.ReactNode
}

type FloatingNavbarProps = {
  navItems: NavItem[]
  action?: NavAction
  className?: string
}

const FloatingNavbar = ({ navItems, action, className }: FloatingNavbarProps) => {
  const [visible, setVisible] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY

      if (current < 80) {
        setVisible(false)
        lastScrollY.current = current
        return
      }

      if (current < lastScrollY.current) {
        setVisible(true)
      } else if (current > lastScrollY.current + 6) {
        setVisible(false)
      }

      lastScrollY.current = current
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className={cn('floating-nav', visible && 'is-visible', className)}>
      <div className="floating-nav__items">
        {navItems.map((item, idx) => {
          if (item.to) {
            return (
              <Link
                key={`${item.name}-${idx}`}
                to={item.to}
                className="floating-nav__item"
                aria-label={item.name}
                title={item.name}
              >
                {item.icon}
                <span className="floating-nav__label">{item.name}</span>
              </Link>
            )
          }

          return (
            <button
              key={`${item.name}-${idx}`}
              type="button"
              onClick={item.onClick}
              className="floating-nav__item"
              aria-label={item.name}
              title={item.name}
            >
              {item.icon}
              <span className="floating-nav__label">{item.name}</span>
            </button>
          )
        })}
      </div>
      {action ? (
        <Link to={action.to} className="floating-nav__action">
          {action.icon}
          <span>{action.label}</span>
        </Link>
      ) : null}
    </div>
  )
}

export default FloatingNavbar
