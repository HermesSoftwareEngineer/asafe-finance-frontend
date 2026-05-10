import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { relatoriosApi } from '../../../lib/api'
import { formatCurrency } from '../../../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../components/ui/table'

interface ExtratoRow { data: string; descricao: string; tipo: 'entrada' | 'saida'; valor_total: number; saldo: number; categoria_nome: string | null }

interface Props {
  dataInicio: string;
  dataFim: string;
  contaId?: string;
  enabled?: boolean;
}

export function ExtratoConta({ dataInicio, dataFim, contaId, enabled = true }: Props) {
  const params = { data_inicio: dataInicio, data_fim: dataFim, conta_id: contaId ? Number(contaId) : undefined }

  const { data, isLoading } = useQuery<ExtratoRow[]>({
    queryKey: ['relatorios', 'extrato', params],
    queryFn: () => relatoriosApi.extratoConta({ ...params, conta_id: Number(contaId) }),
    enabled: enabled && !!contaId,
  })

  if (isLoading && enabled && !!contaId) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!enabled && !data) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Extrato de Conta</CardTitle></CardHeader>
      <CardContent className="p-0">
        {!contaId ? (
          <div className="text-center py-12 text-muted-foreground">Selecione uma conta para gerar o extrato.</div>
        ) : !data?.length ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum lançamento encontrado.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {new Date(row.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="font-medium">{row.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">{row.categoria_nome ?? '—'}</TableCell>
                  <TableCell className={`text-right ${row.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                    {row.tipo === 'entrada' ? '+' : '-'}{formatCurrency(row.valor_total)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${row.saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(row.saldo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
