import { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }

const Button = ({ variant = 'primary', children, ...rest }: Props) => (
  <button className={`btn btn--${variant}`} {...rest}>
    {children}
  </button>
)

export default Button