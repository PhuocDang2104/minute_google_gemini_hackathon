import React, { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

export const BackgroundRippleEffect = ({
  rows = 8,
  cols = 27,
  cellSize = 56,
  className,
  interactive = true,
}: {
  rows?: number
  cols?: number
  cellSize?: number
  className?: string
  interactive?: boolean
}) => {
  const [clickedCell, setClickedCell] = useState<{ row: number; col: number } | null>(null)
  const [rippleKey, setRippleKey] = useState(0)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setClickedCell({ row: Math.floor(rows / 2), col: Math.floor(cols / 2) })
    setRippleKey(prev => prev + 1)
  }, [rows, cols])

  return (
    <div
      ref={ref}
      className={cn('ripple-grid', interactive && 'ripple-grid--interactive', className)}
      style={{
        ['--cell-border-color' as string]: 'rgba(17, 17, 17, 0.22)',
        ['--cell-fill-color' as string]: 'rgba(247, 167, 69, 0.05)',
        ['--cell-shadow-color' as string]: 'rgba(247, 167, 69, 0.25)',
      }}
    >
      <div className="ripple-grid__inner">
        <div className="ripple-grid__overlay" />
        <DivGrid
          key={`base-${rippleKey}`}
          className="ripple-grid__mask"
          rows={rows}
          cols={cols}
          cellSize={cellSize}
          borderColor="var(--cell-border-color)"
          fillColor="var(--cell-fill-color)"
          clickedCell={clickedCell}
          onCellClick={(row, col) => {
            if (!interactive) return
            setClickedCell({ row, col })
            setRippleKey(prev => prev + 1)
          }}
          interactive={interactive}
        />
      </div>
    </div>
  )
}

type DivGridProps = {
  className?: string
  rows: number
  cols: number
  cellSize: number
  borderColor: string
  fillColor: string
  clickedCell: { row: number; col: number } | null
  onCellClick?: (row: number, col: number) => void
  interactive?: boolean
}

type CellStyle = React.CSSProperties & {
  ['--delay']?: string
  ['--duration']?: string
}

const DivGrid = ({
  className,
  rows,
  cols,
  cellSize,
  borderColor,
  fillColor,
  clickedCell,
  onCellClick,
  interactive = true,
}: DivGridProps) => {
  const cells = useMemo(() => Array.from({ length: rows * cols }, (_, idx) => idx), [rows, cols])
  const maxDistance = Math.ceil(Math.min(rows, cols) * 0.55)
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
    gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
    width: cols * cellSize,
    height: rows * cellSize,
    marginInline: 'auto',
  }

  return (
    <div className={cn('ripple-grid__grid', className)} style={gridStyle}>
      {cells.map(idx => {
        const rowIdx = Math.floor(idx / cols)
        const colIdx = idx % cols
        const distance = clickedCell ? Math.hypot(clickedCell.row - rowIdx, clickedCell.col - colIdx) : 0
        const isActive = !!clickedCell && distance <= maxDistance
        const delay = isActive ? Math.max(0, distance * 45) : 0
        const duration = isActive ? 180 + distance * 60 : 0

        const style: CellStyle = {}
        if (isActive) {
          style['--delay'] = `${delay}ms`
          style['--duration'] = `${duration}ms`
        }

        return (
          <div
            key={idx}
            className={cn('ripple-cell', isActive && 'ripple-cell--active', !interactive && 'ripple-cell--static')}
            style={{
              backgroundColor: fillColor,
              borderColor,
              ...style,
            }}
            onClick={interactive ? () => onCellClick?.(rowIdx, colIdx) : undefined}
          />
        )
      })}
    </div>
  )
}

export default BackgroundRippleEffect
