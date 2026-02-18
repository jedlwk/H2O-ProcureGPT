'use client'

import { useState } from 'react'
import { useCompanies } from '@/lib/hooks/use-historical'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompanySelectorProps {
  value: string
  onChange: (value: string) => void
}

export function CompanySelector({ value, onChange }: CompanySelectorProps) {
  const { data: companies = [] } = useCompanies()
  const [open, setOpen] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newCompany, setNewCompany] = useState('')

  const handleAddNew = () => {
    if (newCompany.trim()) {
      onChange(newCompany.trim())
      setShowNew(false)
      setNewCompany('')
    }
  }

  if (showNew) {
    return (
      <div className="space-y-2">
        <Label>New Company Name</Label>
        <div className="flex gap-2">
          <Input
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            placeholder="Enter company name..."
            onKeyDown={(e) => e.key === 'Enter' && handleAddNew()}
          />
          <Button onClick={handleAddNew} disabled={!newCompany.trim()}>
            Add
          </Button>
          <Button variant="ghost" onClick={() => setShowNew(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>EU Company</Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-80 justify-between"
            >
              {value || 'Select company...'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0">
            <Command>
              <CommandInput placeholder="Search companies..." />
              <CommandList>
                <CommandEmpty>No company found.</CommandEmpty>
                <CommandGroup>
                  {companies.map((company) => (
                    <CommandItem
                      key={company}
                      value={company}
                      onSelect={() => {
                        onChange(company)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === company ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {company}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="icon" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
