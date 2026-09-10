import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button variants', () => {
  it('applies a quiet outline treatment without leaking variant props to the DOM', () => {
    render(<Button variant="outline" size="sm">Review</Button>)
    const button = screen.getByRole('button', { name: 'Review' })
    expect(button).toHaveClass('border')
    expect(button).not.toHaveAttribute('variant')
    expect(button).not.toHaveAttribute('size')
  })

  it('keeps icon-only controls at the minimum target size', () => {
    render(<Button size="icon" aria-label="Close">x</Button>)
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('h-11', 'w-11')
  })
})
