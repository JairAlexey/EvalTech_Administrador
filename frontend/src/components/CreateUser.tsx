import { useState } from 'react';
import authService from '../services/authService';

interface CreateUserProps {
    onClose: () => void;
    onUserCreated: () => void;
}

const ROLE_OPTIONS = [
    { value: 'admin', label: 'Administrador' },
    { value: 'evaluator', label: 'Evaluador' },
];

export default function CreateUser({ onClose, onUserCreated }: CreateUserProps) {
    const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'evaluator' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await authService.createUser(form);
            onUserCreated();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al crear usuario');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">Crear nuevo usuario</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        name="firstName"
                        placeholder="Nombre"
                        value={form.firstName}
                        onChange={handleChange}
                        className="w-full border px-3 py-2 rounded"
                        required
                    />
                    <input
                        name="lastName"
                        placeholder="Apellido"
                        value={form.lastName}
                        onChange={handleChange}
                        className="w-full border px-3 py-2 rounded"
                        required
                    />
                    <input
                        name="email"
                        type="email"
                        placeholder="Correo electrónico"
                        value={form.email}
                        onChange={handleChange}
                        className="w-full border px-3 py-2 rounded"
                        required
                    />
                    <input
                        name="password"
                        type="password"
                        placeholder="Contraseña"
                        value={form.password}
                        onChange={handleChange}
                        className="w-full border px-3 py-2 rounded"
                        required
                    />
                    <select
                        name="role"
                        value={form.role}
                        onChange={handleChange}
                        className="w-full border px-3 py-2 rounded"
                        required
                    >
                        {ROLE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    {error && <div className="text-red-600 text-sm">{error}</div>}
                    <div className="flex justify-end space-x-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded">Cancelar</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
                            {loading ? 'Creando...' : 'Crear'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}