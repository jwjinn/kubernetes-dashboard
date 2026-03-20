export type ResourceHealthStatus = 'healthy' | 'warning' | 'failed';

export function statusDisplayLabel(status: ResourceHealthStatus): string {
    switch (status) {
        case 'failed':
            return '점검 필요';
        case 'warning':
            return '주의';
        default:
            return '정상';
    }
}

export function statusBadgeClass(status: ResourceHealthStatus): string {
    switch (status) {
        case 'failed':
            return 'bg-red-500 text-white';
        case 'warning':
            return 'bg-amber-500 text-white';
        default:
            return 'bg-emerald-500 text-white';
    }
}

export function statusAccentClass(status: ResourceHealthStatus): string {
    switch (status) {
        case 'failed':
            return 'bg-red-500';
        case 'warning':
            return 'bg-amber-500';
        default:
            return 'bg-emerald-500';
    }
}
