'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { IDENTITY_SOURCE_SYSTEMS } from '@/lib/constants';

interface Employee {
  id: string;
  name: string;
  nip: string | null;
}
interface Mapping {
  id: string;
  employeeId: string;
  sourceSystem: string;
  externalCode: string;
}

export default function IdentityMappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Mapping[]>('/api/master/identity-mappings'), api.get<Employee[]>('/api/master/employees')]).then(
      ([m, e]) => {
        setMappings(m);
        setEmployees(e);
        setLoading(false);
      }
    );
  }, []);

  const employeeName = (id: string) => employees.find((e) => e.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Pemetaan Identitas Lintas Sistem</h1>
        <p className="text-sm text-slate-500">
          Seluruh pemetaan kode pegawai antar SIMRS, BARAYA, dan data klaim BPJS ke ID internal PINUS. Tambahkan
          pemetaan baru dari halaman detail masing-masing pegawai.
        </p>
      </div>
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Memuat...</p>
        ) : mappings.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Belum ada pemetaan identitas.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Pegawai</th>
                <th>Sistem Sumber</th>
                <th>Kode Eksternal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td>{employeeName(m.employeeId)}</td>
                  <td>{IDENTITY_SOURCE_SYSTEMS.find((s) => s.value === m.sourceSystem)?.label ?? m.sourceSystem}</td>
                  <td className="font-mono">{m.externalCode}</td>
                  <td>
                    <Link href={`/master/employees/${m.employeeId}`} className="text-lembang-700 hover:underline">
                      Lihat pegawai
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
