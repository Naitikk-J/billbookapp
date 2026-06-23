import type { Company, Invoice } from '@/lib/types';
import { ModernTemplate } from './ModernTemplate';
import { ClassicTemplate } from './ClassicTemplate';
import { TravelTemplate } from './TravelTemplate';
import type { ReactElement } from 'react';

export interface TemplateOption {
  id: string;
  name: string;
  description: string;
  accent: string;
  render: (args: { invoice: Invoice; company: Company | null }) => ReactElement;
}

export const TEMPLATES: TemplateOption[] = [
  {
    id: 'modern',
    name: 'Aurora',
    description: 'Modern, colorful, with calm geometry.',
    accent: 'from-royal-500 to-emerald-500',
    render: ({ invoice, company }) => <ModernTemplate invoice={invoice} company={company} />,
  },
  {
    id: 'classic',
    name: 'Continental',
    description: 'Crisp typography, banker-friendly classic.',
    accent: 'from-navy-700 to-navy-500',
    render: ({ invoice, company }) => <ClassicTemplate invoice={invoice} company={company} />,
  },
  {
    id: 'travel',
    name: 'Voyage',
    description: 'Travel-first hero with destination focus.',
    accent: 'from-emerald-500 to-teal-400',
    render: ({ invoice, company }) => <TravelTemplate invoice={invoice} company={company} />,
  },
];

export function getTemplate(id: string): TemplateOption {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
