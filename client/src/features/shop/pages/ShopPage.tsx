import { Store } from 'lucide-react';
import { toast } from 'sonner';
import {
  BOT_META,
  COMING_SOON_MODULES,
  MODULE_META,
  PAID_TIERS,
  PLAN_META,
  PLAN_TIERS,
  PROJECT_MODULES,
  minimumPlan,
  planAllows,
  type PaidTier,
  type ProjectModule,
} from '@msr/shared/modules';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ProjectIcon } from '../../../components/ui/ProjectIcon';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useShell } from '../../../hooks/useShell';
import { errorMessage } from '../../../lib/api';
import { useBuyPack, useShop, useSubscribe } from '../api';
import { ModuleCard } from '../components/ModuleCard';
import { PackPicker } from '../components/PackPicker';
import { PlanCard } from '../components/PlanCard';
import { PlanUsage } from '../components/PlanUsage';
import { moduleAccess, packLeft } from '../moduleAccess';

export function ShopPage() {
  const getPlan = (tier: PaidTier) =>
    subscribe.mutate(tier, {
      onSuccess: () => toast.success(`You're on ${PLAN_META[tier].label}`),
      onError: (error) => toast.error(errorMessage(error)),
    });

  const getPack = (module: ProjectModule, projects: number) =>
    buyPack.mutate(
      { module, projects },
      {
        onSuccess: () => toast.success(`${projects} ${MODULE_META[module].label} projects added`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  const shop = useShop();
  const subscribe = useSubscribe();
  const buyPack = useBuyPack();
  const { openCreateProject } = useShell();
  const tier = shop.data?.plan.tier ?? 'free';
  const rank = PLAN_TIERS.indexOf(tier);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Shop"
        icon={<Store className="size-7 text-accent-text" aria-hidden />}
        description="Plans and modules. Everything is free during launch."
      >
        {shop.data && <PlanUsage plan={shop.data.plan} className="max-w-md" />}
      </PageHeader>
      {shop.error && <ErrorState error={shop.error} onRetry={shop.refetch} />}
      {shop.isPending && <Skeleton className="h-80" />}
      {shop.data && (
        <>
          <section aria-labelledby="plans-heading" className="flex flex-col gap-3">
            <h2 id="plans-heading" className="text-lg font-semibold">
              Plans
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {PLAN_TIERS.map((plan, index) => (
                <PlanCard
                  key={plan}
                  tier={plan}
                  current={plan === tier}
                  action={
                    PAID_TIERS.includes(plan as PaidTier) &&
                    index > rank && (
                      <Button
                        block
                        loading={subscribe.isPending && subscribe.variables === plan}
                        onClick={() => getPlan(plan as PaidTier)}
                      >
                        Get {PLAN_META[plan].label}
                      </Button>
                    )
                  }
                />
              ))}
            </div>
          </section>
          <section aria-labelledby="modules-heading" className="flex flex-col gap-3">
            <h2 id="modules-heading" className="text-lg font-semibold">
              Modules
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {PROJECT_MODULES.map((module) => {
                const access = moduleAccess(shop.data, module);
                const left = packLeft(shop.data, module);
                return (
                  <ModuleCard
                    key={module}
                    title={MODULE_META[module].label}
                    description={MODULE_META[module].description}
                    icon={<ProjectIcon name={MODULE_META[module].icon} />}
                    features={MODULE_META[module].features}
                    status={access === 'locked' ? 'locked' : 'included'}
                    statusLabel={
                      access === 'locked'
                        ? `Needs ${PLAN_META[minimumPlan(module)].label}`
                        : access === 'pack'
                          ? 'From your packs'
                          : 'In your plan'
                    }
                    badges={
                      <>
                        {PLAN_TIERS.filter((plan) => planAllows(plan, module)).map((plan) => (
                          <Badge key={plan} size="xs" variant="outline" label={PLAN_META[plan].label} />
                        ))}
                        {left > 0 && <Badge size="xs" tone="info" label={`${left} projects left`} />}
                      </>
                    }
                    action={
                      access !== 'locked' && (
                        <Button size="sm" variant="secondary" onClick={() => openCreateProject(module)}>
                          Start a project
                        </Button>
                      )
                    }
                  >
                    <PackPicker
                      label={MODULE_META[module].label}
                      pending={buyPack.isPending && buyPack.variables?.module === module}
                      onBuy={(projects) => getPack(module, projects)}
                    />
                  </ModuleCard>
                );
              })}
              <ModuleCard
                title={BOT_META.label}
                description={BOT_META.description}
                icon={<ProjectIcon name={BOT_META.icon} />}
                features={BOT_META.features}
                status={PLAN_META[tier].bot === 'none' ? 'locked' : 'included'}
                statusLabel={
                  PLAN_META[tier].bot === 'none'
                    ? 'Needs Personal'
                    : PLAN_META[tier].bot === 'household'
                      ? 'Households'
                      : 'Any project'
                }
                badges={
                  <>
                    <Badge size="xs" variant="outline" label="Personal: households" />
                    <Badge size="xs" variant="outline" label="Pro: any project" />
                  </>
                }
              />
              {COMING_SOON_MODULES.map((module) => (
                <ModuleCard
                  key={module}
                  title={MODULE_META[module].label}
                  description={MODULE_META[module].description}
                  icon={<ProjectIcon name={MODULE_META[module].icon} />}
                  features={MODULE_META[module].features}
                  status="coming_soon"
                  badges={<Badge size="xs" variant="outline" label={PLAN_META[minimumPlan(module)].label} />}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
