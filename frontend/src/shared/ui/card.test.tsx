import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardTitle } from './card'
import '@testing-library/jest-dom'

describe('Card Component', () => {
  it('renders a card with title', () => {
    render(
      <Card>
        <CardTitle>Test Title</CardTitle>
      </Card>
    )
    
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('applies custom class names', () => {
    const { container } = render(
      <Card className="custom-class" />
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
