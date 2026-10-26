import { Download, FileDown, FileUp, Upload } from 'lucide-react';
import { useState } from 'react';
import type { ProjectDetail } from '@msr/shared/types';
import { Button } from '../../../components/ui/Button';
import { Menu } from '../../../components/ui/Menu';
import type { FilterValues } from '../../../hooks/useUrlFilters';
import { downloadUrl } from '../../../lib/download';
import { exportUrl, templateUrl } from '../api';
import { ImportTasksModal } from './ImportTasksModal';

interface ImportExportMenuProps {
  project: Pick<ProjectDetail, 'key' | 'name'>;
  filters: FilterValues;
  canImport: boolean;
}

export function ImportExportMenu({ project, filters, canImport }: ImportExportMenuProps) {
  const [importing, setImporting] = useState(false);

  return (
    <>
      <Menu
        trigger={
          <Button size="sm" variant="ghost" leftIcon={<FileDown />}>
            Import / Export
          </Button>
        }
        items={[
          {
            label: 'Import CSV or Excel…',
            icon: <Upload />,
            onSelect: () => setImporting(true),
            hidden: !canImport,
          },
          { type: 'separator', hidden: !canImport },
          { type: 'label', label: 'Export with current filters' },
          {
            label: 'Excel (.xlsx)',
            icon: <Download />,
            onSelect: () => downloadUrl(exportUrl(project.key, 'xlsx', filters)),
          },
          {
            label: 'CSV',
            icon: <Download />,
            onSelect: () => downloadUrl(exportUrl(project.key, 'csv', filters)),
          },
          { type: 'separator' },
          { type: 'label', label: 'Import templates' },
          { label: 'Excel template', icon: <FileUp />, onSelect: () => downloadUrl(templateUrl('xlsx')) },
          { label: 'CSV template', icon: <FileUp />, onSelect: () => downloadUrl(templateUrl('csv')) },
        ]}
      />
      <ImportTasksModal open={importing} onOpenChange={setImporting} project={project} />
    </>
  );
}
