import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AI_PROVIDERS, AI_PROVIDER_META, type AiProvider } from '@msr/shared/enums';
import { Banner } from '../../../components/ui/Banner';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { errorMessage } from '../../../lib/api';
import { useUpdateMe } from '../../auth/api';
import { useAiKeys } from '../aiKeysApi';
import { ApiKeyRow } from '../components/ApiKeyRow';
import { MotivationSettings } from '../components/MotivationSettings';
import { SettingsSection } from '../components/SettingsSection';

export function AiSettings() {
  const makeDefault = (aiProvider: AiProvider) =>
    updateMe.mutate(
      { preferences: { aiProvider } },
      {
        onSuccess: () => toast.success(`${AI_PROVIDER_META[aiProvider].label} is your default AI`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  const user = useCurrentUser();
  const updateMe = useUpdateMe();
  const keys = useAiKeys();
  const savedProviders = keys.data?.map((key) => key.provider) ?? [];
  const defaultProvider =
    savedProviders.find((provider) => provider === user.preferences.aiProvider) ?? savedProviders[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="AI providers"
        description="Use your own Claude, ChatGPT, Gemini or Grok account for AI features. Each key is tested with the provider before it's saved."
      >
        <div className="flex flex-col gap-3">
          <Banner tone="info" icon={<ShieldCheck />}>
            Keys are encrypted on the server and never shown again — only their last 4 characters.
          </Banner>
          {keys.isPending && <Skeleton className="h-40" />}
          {keys.data && (
            <div className="flex flex-col divide-y divide-border">
              {AI_PROVIDERS.map((provider) => (
                <ApiKeyRow
                  key={provider}
                  provider={provider}
                  saved={keys.data.find((key) => key.provider === provider)}
                  isDefault={provider === defaultProvider}
                  onMakeDefault={() => makeDefault(provider)}
                />
              ))}
            </div>
          )}
        </div>
      </SettingsSection>
      <SettingsSection
        title="Motivation"
        description="How the AI plans a new idea for you: how often you get a deadline, how big each step is, and how much the AI takes on."
      >
        <MotivationSettings />
      </SettingsSection>
    </div>
  );
}
