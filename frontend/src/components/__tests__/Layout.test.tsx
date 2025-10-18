import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Layout } from '../Layout'

const MockLayout = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <Layout>{children}</Layout>
  </BrowserRouter>
)

describe('Layout', () => {
  it('renders the application title', () => {
    render(
      <MockLayout>
        <div>Test content</div>
      </MockLayout>
    )
    
    // Use getAllByText since the title appears in both mobile and desktop versions
    const titles = screen.getAllByText('AI Ticket Platform')
    expect(titles.length).toBeGreaterThan(0)
  })

  it('renders navigation items', () => {
    render(
      <MockLayout>
        <div>Test content</div>
      </MockLayout>
    )
    
    // Use getAllByText since navigation appears in both mobile and desktop versions
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Tickets').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0)
  })

  it('renders user profile information', () => {
    render(
      <MockLayout>
        <div>Test content</div>
      </MockLayout>
    )
    
    // Use getAllByText since user info appears in multiple places
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Manager').length).toBeGreaterThan(0)
  })

  it('renders the main content area', () => {
    render(
      <MockLayout>
        <div data-testid="test-content">Test content</div>
      </MockLayout>
    )
    
    expect(screen.getByTestId('test-content')).toBeInTheDocument()
  })
})