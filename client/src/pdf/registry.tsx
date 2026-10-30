import type { Company, Invoice } from '@/lib/types';
import { TaxInvoiceTemplate } from './TaxInvoiceTemplate';
import { HeritageTemplate } from './HeritageTemplate';
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
    id: 'heritage',
    name: 'Heritage',
    description: 'Boutique gold-trimmed travel-agency classic.',
    accent: 'from-[#C8A057] to-[#1A2F4F]',
    render: ({ invoice, company }) => <HeritageTemplate invoice={invoice} company={company} />,
  },
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
  {
    id: 'safarmate-tax',
    name: 'Safarmate Tax Invoice',
    description: 'GST tax invoice with reimbursement and service-charge columns (Safarmate layout).',
    accent: 'from-[#16324F] to-[#1F8A9B]',
    render: ({ invoice, company }) => <TaxInvoiceTemplate invoice={invoice} company={company} />,
  },
];

export function getTemplate(id: string): TemplateOption {
  const normalized = id === 'safarmate' ? 'safarmate-tax' : id;
  return (
    TEMPLATES.find((t) => t.id === normalized) ??
    TEMPLATES.find((t) => t.id === 'heritage') ??
    TEMPLATES[0]
  );
}
