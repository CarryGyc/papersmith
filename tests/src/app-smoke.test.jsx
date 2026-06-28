import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/App.jsx'

describe('App shell', () => {
  it('renders the PaperSmith workspace shell', () => {
    render(<App />)

    expect(screen.getByLabelText('PaperSmith editor workspace')).toBeInTheDocument()
    expect(screen.getByText('PaperSmith')).toBeInTheDocument()
  })
})
