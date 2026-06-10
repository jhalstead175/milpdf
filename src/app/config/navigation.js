import {
  FileEdit, ListChecks, FolderOpen, Layers, PackageCheck, Upload,
} from 'lucide-react';

export const WORKSPACE_ITEMS = [
  { id: 'review', label: 'Document Review', shortLabel: 'Review', icon: FileEdit },
  { id: 'findings', label: 'Review Queue', shortLabel: 'Queue', icon: ListChecks },
  { id: 'evidence', label: 'Evidence Board', shortLabel: 'Evidence', icon: Layers },
  { id: 'packet', label: 'Packet Builder', shortLabel: 'Packet', icon: PackageCheck },
  { id: 'export', label: 'Production Export', shortLabel: 'Export', icon: Upload },
  { id: 'inbox', label: 'Workspace Home', shortLabel: 'Home', icon: FolderOpen },
];
