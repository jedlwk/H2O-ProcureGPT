export const RECORD_FIELDS = [
  { key: 'sku', label: 'SKU', compulsory: true },
  { key: 'distributor', label: 'Distributor', compulsory: true },
  { key: 'item_description', label: 'Item Description', compulsory: true },
  { key: 'brand', label: 'Brand', compulsory: false },
  { key: 'quote_currency', label: 'Currency', compulsory: true },
  { key: 'quantity', label: 'Quantity', compulsory: true, type: 'number' as const },
  { key: 'serial_no', label: 'Serial No', compulsory: true },
  { key: 'start_date', label: 'Start Date', compulsory: false, type: 'date' as const },
  { key: 'end_date', label: 'End Date', compulsory: false, type: 'date' as const },
  { key: 'unit_price', label: 'Unit Price', compulsory: true, type: 'number' as const },
  { key: 'total_price', label: 'Total Price', compulsory: true, type: 'number' as const },
  { key: 'eu_company', label: 'EU Company', compulsory: true },
  { key: 'comments_notes', label: 'Comments/Notes', compulsory: false },
  { key: 'quotation_ref_no', label: 'Quotation Ref', compulsory: true },
  { key: 'quotation_date', label: 'Quotation Date', compulsory: false, type: 'date' as const },
  { key: 'quotation_end_date', label: 'Quotation End Date', compulsory: false, type: 'date' as const },
  { key: 'quotation_validity', label: 'Validity', compulsory: false },
] as const

export const SUPPORTED_CURRENCIES = ['SGD', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'MYR', 'AUD']

export const VALIDATION_COLORS = {
  valid: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
  pending: 'text-muted-foreground',
} as const

export const VALIDATION_BG = {
  valid: 'bg-emerald-500/10 border-emerald-500/20',
  warning: 'bg-amber-500/10 border-amber-500/20',
  error: 'bg-red-500/10 border-red-500/20',
  pending: 'bg-muted/50 border-border',
} as const

export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: 'LayoutDashboard' as const },
  { href: '/upload', label: 'Upload & Extract', icon: 'Upload' as const },
  { href: '/validate', label: 'Validate & Benchmark', icon: 'CheckCircle' as const },
  { href: '/history', label: 'Historical Records', icon: 'Archive' as const },
  { href: '/analyst', label: 'AI Analyst', icon: 'Bot' as const },
] as const
