import { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement>

const Input = (props: Props) => <input className="input" {...props} />

export default Input