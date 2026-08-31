import { useState } from 'react'
import { Truck, ArrowUpRight, ChevronDown, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'

const RECENT_TRANSACTIONS = [
  {
    id: 1,
    title: 'Kohaku Red',
    price: '₱ 1,350.00',
    orderNumber: '#6767',
    status: 'Completed',
    avatarBg: 'bg-rose-500/15 text-rose-600',
    initials: 'KR',
  },
  {
    id: 2,
    title: 'Joker',
    price: '₱ 1,450.00',
    orderNumber: '#69420',
    status: 'Pending',
    avatarBg: 'bg-emerald-500/15 text-emerald-600',
    initials: 'JK',
  },
  {
    id: 3,
    title: 'Mr. Chow Super Rice',
    price: '₱ 1,250.00',
    orderNumber: '#15321',
    status: 'Completed',
    avatarBg: 'bg-amber-500/15 text-amber-600',
    initials: 'MC',
  },
]

const POPULAR_PURCHASES = [
  {
    id: 1,
    title: 'Joker',
    orders: 'Orders: x50',
    stockStatus: 'In Stock',
    price: '₱1,450.00',
    avatarBg: 'bg-emerald-500/15 text-emerald-600',
    initials: 'JK',
  },
  {
    id: 2,
    title: 'Kohaku Red',
    orders: 'Orders: x21',
    stockStatus: 'In Stock',
    price: '₱1,350.00',
    avatarBg: 'bg-rose-500/15 text-rose-600',
    initials: 'KR',
  },
  {
    id: 3,
    title: 'Mr. Chow Super Rice',
    orders: 'Orders: x20',
    stockStatus: 'In Stock',
    price: '₱1,250.00',
    avatarBg: 'bg-amber-500/15 text-amber-600',
    initials: 'MC',
  },
]

export function ExecutiveDashboard() {
  const { data: vehicles = [] } = useDeliveryVehicles()

  const [period, setPeriod] = useState<'This week' | 'This month' | 'This year'>('This week')
  const [yearPeriod, setYearPeriod] = useState<'2026' | '2025'>('2026')

  const deliveriesInProgress = vehicles.filter((v) => v.status === 'IN_DELIVERY').length || 4

  return (
    <div className="flex flex-col gap-6">
      {/* Top 3 KPI Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Daily Revenue */}
        <Card className="border-border/80 bg-card/90 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground">
                Total Daily Revenue
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-1">
                ₱141,000.67
              </div>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-sm shadow-sm">
              ₱
            </div>
          </div>
          <div className="mt-4 text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <Clock className="size-3 text-muted-foreground/70" />
            <span>Last updated: 4:56 PM</span>
          </div>
        </Card>

        {/* Card 2: Real-Time Gross Margin */}
        <Card className="border-border/80 bg-card/90 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground">
                Real-Time Gross Margin
              </span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  ₱11,985.00
                </span>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px] font-bold py-0.5"
                >
                  +32.40% Gain
                </Badge>
              </div>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-sm shadow-sm">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
          <div className="mt-4 text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <Clock className="size-3 text-muted-foreground/70" />
            <span>Last updated: 1:00 PM</span>
          </div>
        </Card>

        {/* Card 3: Deliveries in Progress */}
        <Card className="border-border/80 bg-card/90 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground">
                Deliveries in progress
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-1">
                {deliveriesInProgress}
              </div>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-sm shadow-sm">
              <Truck className="size-4" />
            </div>
          </div>
          <div className="mt-4 text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <Clock className="size-3 text-muted-foreground/70" />
            <span>Last updated: 10:30 AM</span>
          </div>
        </Card>
      </div>

      {/* Middle Row: Recent Transactions & Popular Purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Transactions */}
        <Card className="border-border/80 bg-card/90 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-foreground">
              Recent Transactions
            </CardTitle>
            <Button
              variant="default"
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-7 px-3 rounded-full shadow-xs"
            >
              See All
            </Button>
          </CardHeader>

          <CardContent className="p-0 flex flex-col gap-3">
            {RECENT_TRANSACTIONS.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-10 items-center justify-center rounded-full font-bold text-xs shadow-xs ${tx.avatarBg}`}
                  >
                    {tx.initials}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-foreground leading-tight">{tx.title}</h5>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {tx.price}{' '}
                      <span className="font-mono text-muted-foreground/80">{tx.orderNumber}</span>
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                    tx.status === 'Completed'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  }`}
                >
                  {tx.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Popular Purchases */}
        <Card className="border-border/80 bg-card/90 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-foreground">Popular Purchases</CardTitle>
            <Button
              variant="default"
              size="sm"
              onClick={() => setPeriod(period === 'This week' ? 'This month' : 'This week')}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-7 px-3 rounded-full shadow-xs gap-1"
            >
              {period} <ChevronDown className="size-3" />
            </Button>
          </CardHeader>

          <CardContent className="p-0 flex flex-col gap-3">
            {POPULAR_PURCHASES.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-10 items-center justify-center rounded-full font-bold text-xs shadow-xs ${p.avatarBg}`}
                  >
                    {p.initials}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-foreground leading-tight">{p.title}</h5>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.orders}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-bold text-rose-600 block">{p.stockStatus}</span>
                  <span className="text-xs font-extrabold text-foreground">{p.price}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Sales Overview Area Chart */}
      <Card className="border-border/80 bg-card/90 shadow-sm rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
          <div>
            <h3 className="text-base font-bold text-foreground">Sales Overview</h3>
            {/* Legend */}
            <div className="flex items-center gap-5 mt-3 text-xs font-semibold text-foreground/80">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-xs bg-emerald-500" />
                <span>Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-xs bg-slate-400" />
                <span>Sales</span>
              </div>
            </div>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={() => setYearPeriod(yearPeriod === '2026' ? '2025' : '2026')}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-7 px-3 rounded-full shadow-xs gap-1"
          >
            This year ({yearPeriod}) <ChevronDown className="size-3" />
          </Button>
        </div>

        {/* SVG Area Chart */}
        <div className="relative w-full overflow-hidden">
          <div className="h-64 w-full">
            <svg viewBox="0 0 1000 240" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line
                x1="40"
                y1="20"
                x2="980"
                y2="20"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1="40"
                y1="55"
                x2="980"
                y2="55"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1="40"
                y1="90"
                x2="980"
                y2="90"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1="40"
                y1="125"
                x2="980"
                y2="125"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1="40"
                y1="160"
                x2="980"
                y2="160"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1="40"
                y1="195"
                x2="980"
                y2="195"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line x1="40" y1="220" x2="980" y2="220" stroke="#cbd5e1" strokeWidth="1.5" />

              {/* Y Axis Numbers */}
              <text x="990" y="24" fill="#94a3b8" fontSize="11" textAnchor="start">
                450k
              </text>
              <text x="990" y="59" fill="#94a3b8" fontSize="11" textAnchor="start">
                375k
              </text>
              <text x="990" y="94" fill="#94a3b8" fontSize="11" textAnchor="start">
                300k
              </text>
              <text x="990" y="129" fill="#94a3b8" fontSize="11" textAnchor="start">
                225k
              </text>
              <text x="990" y="164" fill="#94a3b8" fontSize="11" textAnchor="start">
                150k
              </text>
              <text x="990" y="199" fill="#94a3b8" fontSize="11" textAnchor="start">
                75k
              </text>
              <text x="990" y="224" fill="#94a3b8" fontSize="11" textAnchor="start">
                0
              </text>

              {/* Sales Grey Area */}
              <path
                d="M 50 215 L 125 210 L 200 205 L 275 190 L 275 220 L 50 220 Z"
                fill="url(#salesGrad)"
              />
              <path
                d="M 50 215 L 125 210 L 200 205 L 275 190"
                fill="none"
                stroke="#64748b"
                strokeWidth="2.5"
              />

              {/* Revenue Green Area */}
              <path
                d="M 50 210 L 125 180 L 200 195 L 275 160 L 275 220 L 50 220 Z"
                fill="url(#revenueGrad)"
              />
              <path
                d="M 50 210 L 125 180 L 200 195 L 275 160"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
              />

              {/* Active data points */}
              <circle cx="50" cy="210" r="3.5" fill="#10b981" />
              <circle cx="125" cy="180" r="3.5" fill="#10b981" />
              <circle cx="200" cy="195" r="3.5" fill="#10b981" />
              <circle cx="275" cy="160" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
            </svg>
          </div>

          {/* Month Labels */}
          <div className="grid grid-cols-12 text-center text-xs font-semibold text-muted-foreground pt-2">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span className="font-bold text-foreground">Apr</span>
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
            <span>Aug</span>
            <span>Sep</span>
            <span>Oct</span>
            <span>Nov</span>
            <span>Dec</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
