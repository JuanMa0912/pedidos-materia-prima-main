export const COBERTURA_CRITICA = 2
export const COBERTURA_ALERTA = 4

export type CoberturaNivel = "critico" | "alerta" | "seguro"

export interface CoberturaItem<T = unknown> {
    cobertura: number | null | undefined
    payload?: T
}

export type CoberturaResumen<T = unknown> = {
    critico: CoberturaItem<T>[]
    alerta: CoberturaItem<T>[]
    seguro: CoberturaItem<T>[]
}

export function obtenerNivelCobertura(
    cobertura: number | null | undefined
): CoberturaNivel | null {
    if (cobertura == null) return null
    if (cobertura < COBERTURA_CRITICA) return "critico"
    if (cobertura < COBERTURA_ALERTA) return "alerta"
    return "seguro"
}

export function agruparCobertura<T = unknown>(
    materiales: CoberturaItem<T>[]
): CoberturaResumen<T> {
    return materiales.reduce<CoberturaResumen<T>>(
        (acc, mat) => {
            const nivel = obtenerNivelCobertura(mat.cobertura)
            if(!nivel) return acc
            acc[nivel].push(mat)
            return acc
        },
        {critico: [], alerta: [], seguro: []}
    )
}