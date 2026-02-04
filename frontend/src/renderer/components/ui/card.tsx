import { ReactNode } from 'react'

type Props = {
  title?: string
  children: ReactNode
}

const Card = ({ title, children }: Props) => (
  <div className="card">
    {title && <div className="card__title">{title}</div>}
    <div className="card__body">{children}</div>
  </div>
)

export default Card