import { render, screen } from '@testing-library/react';
import { KPIWidget } from '../KPIWidget';
import { DashboardKPI } from '../../../types/analytics';

describe('KPIWidget', () => {
  const mockKPI: DashboardKPI = {
    id: 'test-kpi',
    title: 'Test Metric',
    value: 1234,
    format: 'number',
    color: 'blue',
    change: 5.2,
    changeType: 'increase',
  };

  it('renders KPI title and value correctly', () => {
    render(<KPIWidget kpi={mockKPI} />);
    
    expect(screen.getByText('Test Metric')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('displays change percentage when provided', () => {
    render(<KPIWidget kpi={mockKPI} />);
    
    expect(screen.getByText('5.2%')).toBeInTheDocument();
    expect(screen.getByText('vs last period')).toBeInTheDocument();
  });

  it('formats percentage values correctly', () => {
    const percentageKPI: DashboardKPI = {
      ...mockKPI,
      value: 94.2,
      format: 'percentage',
    };
    
    render(<KPIWidget kpi={percentageKPI} />);
    
    expect(screen.getByText('94.2%')).toBeInTheDocument();
  });

  it('formats duration values correctly', () => {
    const durationKPI: DashboardKPI = {
      ...mockKPI,
      value: 2.4,
      format: 'duration',
    };
    
    render(<KPIWidget kpi={durationKPI} />);
    
    expect(screen.getByText('2.4h')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<KPIWidget kpi={mockKPI} isLoading={true} />);
    
    const loadingElements = document.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('applies correct color classes based on color prop', () => {
    const { container } = render(<KPIWidget kpi={mockKPI} />);
    
    const valueElement = container.querySelector('.text-blue-600');
    expect(valueElement).toBeInTheDocument();
  });
});