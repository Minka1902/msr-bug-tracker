import { useOutletContext } from 'react-router';
import type { ProjectDetail } from '@msr/shared/types';

export const useProjectContext = () => useOutletContext<{ project: ProjectDetail }>().project;
