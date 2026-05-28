import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useHierarchy() {
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => base44.entities.Company.list() });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list() });
  const { data: businessUnits = [] } = useQuery({ queryKey: ['businessUnits'], queryFn: () => base44.entities.BusinessUnit.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });
  const { data: processes = [] } = useQuery({ queryKey: ['processes'], queryFn: () => base44.entities.Process.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: systems = [] } = useQuery({ queryKey: ['systems'], queryFn: () => base44.entities.AssetSystem.list() });
  const { data: components = [] } = useQuery({ queryKey: ['components'], queryFn: () => base44.entities.Component.list() });
  const { data: spareParts = [] } = useQuery({ queryKey: ['spareParts'], queryFn: () => base44.entities.SparePart.list() });

  const getName = (list, id) => list.find(x => x.id === id)?.name || '—';

  return {
    companies, sites, businessUnits, locations, processes, assets, systems, components, spareParts,
    getCompanyName: (id) => getName(companies, id),
    getSiteName: (id) => getName(sites, id),
    getBusinessUnitName: (id) => getName(businessUnits, id),
    getLocationName: (id) => getName(locations, id),
    getProcessName: (id) => getName(processes, id),
    getAssetName: (id) => getName(assets, id),
    getSystemName: (id) => getName(systems, id),
    getComponentName: (id) => getName(components, id),
  };
}