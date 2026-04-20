'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Category } from '@/lib/supabase/types';
import { Plus, Search, Edit, Trash2, Tags, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface CategoryWithCount extends Category {
  productCount: number;
}

interface CategoriesClientProps {
  initialCategories: CategoryWithCount[];
}

export default function CategoriesClient({
  initialCategories,
}: CategoriesClientProps) {
  const supabase = createClient();
  const [categories, setCategories] = useState<CategoryWithCount[]>(initialCategories);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        description: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const categoryData = {
        name: formData.name,
        description: formData.description || null,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', editingCategory.id);

        if (error) throw error;

        setCategories(
          (categories ?? []).map((c) =>
            c.id === editingCategory.id ? { ...c, ...categoryData } : c
          )
        );
      } else {
        const { data, error } = await supabase
          .from('categories')
          .insert(categoryData)
          .select()
          .single();

        if (error) throw error;

        setCategories([...categories, { ...data, productCount: 0 }]);
      }

      closeModal();
      toast.success('Kategori berhasil disimpan!');
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Gagal menyimpan kategori!');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);

      if (error) throw error;

      setCategories(categories.filter((c) => c.id !== id));
      setDeleteConfirm(null);
      toast.success('Kategori berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Gagal menghapus kategori!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 'var(--space-4)' }} className="lg:p-8">
      {/* Header */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }} className="lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'var(--text-headline-sm)',
            fontWeight: '700', color: 'var(--color-on-surface)',
          }}>
            Kategori
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)',
            color: 'var(--color-outline)', marginTop: 'var(--space-1)',
          }}>
            Kelola kategori produk Anda
          </p>
        </div>
        <button
          onClick={() => openModal()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--gradient-primary)',
            color: 'var(--color-on-primary)',
            border: 'none', borderRadius: 'var(--radius-lg)',
            fontFamily: 'var(--font-label)', fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <Plus style={{ width: '1.25rem', height: '1.25rem' }} />
          Tambah Kategori
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-6)' }}>
        <Search style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', width: '1.25rem', height: '1.25rem', color: 'var(--color-outline)' }} />
        <input
          type="text"
          placeholder="Cari kategori..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: '2.5rem',
            paddingRight: 'var(--space-4)',
            paddingTop: 'var(--space-2)',
            paddingBottom: 'var(--space-2)',
            border: '1.5px solid var(--color-outline-variant)',
            borderRadius: 'var(--radius-lg)',
            outline: 'none',
            backgroundColor: 'var(--color-surface-container-high)',
            color: 'var(--color-on-surface)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-md)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
        />
      </div>

      {/* Categories List */}
      <div style={{
        backgroundColor: 'var(--color-surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-outline-variant)',
        overflow: 'hidden',
      }}>
        <div>
          {(filteredCategories ?? []).map((category, idx, arr) => (
            <div
              key={category.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--space-4)',
                borderBottom: idx < arr.length - 1 ? '1px solid var(--color-outline-variant)' : 'none',
                transition: 'background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{
                  width: '3rem', height: '3rem',
                  backgroundColor: 'var(--color-primary-fixed)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Tags style={{ width: '1.5rem', height: '1.5rem', color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-body)', fontWeight: '600',
                    fontSize: 'var(--text-body-md)', color: 'var(--color-on-surface)',
                  }}>
                    {category.name}
                  </h3>
                  <p style={{
                    fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                    color: 'var(--color-outline)', marginTop: 'var(--space-1)',
                  }}>
                    {category.productCount} produk
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                <button
                  onClick={() => openModal(category)}
                  style={{
                    padding: 'var(--space-2)',
                    color: 'var(--color-outline)',
                    backgroundColor: 'transparent',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-primary)';
                    e.currentTarget.style.backgroundColor = 'var(--color-primary-fixed)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-outline)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Edit style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
                <button
                  onClick={() => setDeleteConfirm(category.id)}
                  style={{
                    padding: 'var(--space-2)',
                    color: 'var(--color-outline)',
                    backgroundColor: 'transparent',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-error)';
                    e.currentTarget.style.backgroundColor = 'var(--color-error-container)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-outline)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Trash2 style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredCategories.length === 0 && (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <Tags style={{ width: '3rem', height: '3rem', color: 'var(--color-outline-variant)', margin: '0 auto var(--space-4)' }} />
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-outline)' }}>Kategori tidak ditemukan</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '28rem',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-overlay)',
          }}>
            <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--color-outline-variant)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '600', color: 'var(--color-on-surface)' }}>
                  {editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}
                </h2>
                <button
                  onClick={closeModal}
                  style={{
                    padding: 'var(--space-2)',
                    backgroundColor: 'transparent',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', color: 'var(--color-outline)',
                  }}
                >
                  <X style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
                  fontWeight: '500', color: 'var(--color-on-surface-variant)',
                  marginBottom: 'var(--space-2)',
                }}>
                  Nama Kategori *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1.5px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)',
                    outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-body)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                  required
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
                  fontWeight: '500', color: 'var(--color-on-surface-variant)',
                  marginBottom: 'var(--space-2)',
                }}>
                  Deskripsi
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1.5px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)',
                    outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-body)',
                    resize: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                  rows={3}
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-4)' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    flex: 1,
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1px solid var(--color-outline-variant)',
                    color: 'var(--color-on-surface-variant)',
                    borderRadius: 'var(--radius-lg)',
                    fontFamily: 'var(--font-label)', fontWeight: '600',
                    cursor: 'pointer', backgroundColor: 'transparent',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: 'var(--space-2) var(--space-4)',
                    backgroundColor: loading ? 'var(--color-surface-container)' : 'var(--color-primary)',
                    color: loading ? 'var(--color-outline)' : 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontFamily: 'var(--font-label)', fontWeight: '600',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 0.6s linear infinite' }} />}
                  {editingCategory ? 'Simpan' : 'Buat Baru'}
                </button>
              </div>
            </form>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '24rem',
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-overlay)',
          }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '600', color: 'var(--color-on-surface)', marginBottom: 'var(--space-2)' }}>
              Hapus Kategori?
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)', color: 'var(--color-outline)', marginBottom: 'var(--space-6)' }}>
              Ini akan menghapus kategori. Produk-produk yang menggunakan kategori ini akan kehilangan kategorinya.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-4)',
                  border: '1px solid var(--color-outline-variant)',
                  color: 'var(--color-on-surface-variant)',
                  borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-label)', fontWeight: '600',
                  cursor: 'pointer', backgroundColor: 'transparent',
                }}
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-4)',
                  backgroundColor: 'var(--color-error)',
                  color: 'var(--color-on-error)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-label)', fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? '0.5' : '1',
                }}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
