import { create } from 'zustand';

interface FilterState {
    selectedCluster: string;
    setCluster: (cluster: string) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
    selectedCluster: 'all-clusters',
    setCluster: (cluster) => set({ selectedCluster: cluster }),
}));
