import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TrackedMemberOption, TrackedMembersService } from '../../../core/members/tracked-members.service';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/**
 * Categoria de membro retornada pela API.
 */
interface MemberCategoryDto {
  _id: string;
  name: string;
  slug: string;
  color?: string;
}

/**
 * Formulário de criação/edição de categoria.
 */
interface CategoryFormModel {
  name: string;
  slug: string;
  color: string;
}

/**
 * Tela de gestão de categorias do time por servidor Discord.
 */
@Component({
  selector: 'app-categories-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './categories-settings.component.html',
})
export class CategoriesSettingsComponent implements OnInit {
  categories: MemberCategoryDto[] = [];
  members: TrackedMemberOption[] = [];
  memberCategoryById: Record<string, string> = {};

  createForm: CategoryFormModel = this.createInitialForm();
  editForm: CategoryFormModel = this.createInitialForm();
  editingCategoryId: string | null = null;

  loading = false;
  saving = false;
  assigning = false;
  syncingMembers = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly tenantContext: TenantContextService,
    private readonly trackedMembersService: TrackedMembersService,
  ) {}

  /**
   * Indica se há servidor Discord selecionado.
   */
  get hasGuild(): boolean {
    return this.tenantContext.hasGuild;
  }

  /**
   * Nome do servidor monitorado.
   */
  get guildName(): string {
    return this.tenantContext.guildName;
  }

  /**
   * Carrega categorias e membros ao inicializar a tela.
   */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild) {
        this.loadCategories();
        this.loadMembers();
      }
    });
  }

  /**
   * Busca categorias cadastradas no guild.
   */
  loadCategories(): void {
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord e selecione um servidor.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.httpClient.get<{ categories: MemberCategoryDto[] }>(`${this.getBaseUrl()}/categories`).subscribe({
      next: (response) => {
        this.categories = response.categories ?? [];
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar as categorias.';
        this.loading = false;
      },
    });
  }

  /**
   * Carrega membros rastreados para atribuição de categorias.
   */
  loadMembers(): void {
    this.trackedMembersService.listMembers().subscribe({
      next: (members) => {
        this.members = members;
        this.memberCategoryById = Object.fromEntries(
          members.map((member) => [member.id, member.categoryId ?? '']),
        );
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar membros. Sincronize os membros do Discord primeiro.';
      },
    });
  }

  /**
   * Sincroniza membros do Discord e recarrega a lista local.
   */
  syncMembers(): void {
    this.syncingMembers = true;
    this.errorMessage = '';

    this.trackedMembersService.syncMembers().subscribe({
      next: (response) => {
        this.members = response.members ?? [];
        this.memberCategoryById = Object.fromEntries(
          this.members.map((member) => [member.id, member.categoryId ?? '']),
        );
        this.syncingMembers = false;
        const parts = [`${response.syncedCount} sincronizados`];
        if ((response.deactivatedCount ?? 0) > 0) {
          parts.push(`${response.deactivatedCount} removidos do rastreamento`);
        }
        if ((response.reactivatedCount ?? 0) > 0) {
          parts.push(`${response.reactivatedCount} reativados`);
        }
        this.successMessage = `${parts.join(', ')}.`;
      },
      error: (error) => {
        this.syncingMembers = false;
        this.errorMessage = error.error?.error ?? 'Falha ao sincronizar membros.';
      },
    });
  }

  /**
   * Salva vínculos de categoria para todos os membros listados.
   */
  saveMemberCategories(): void {
    if (this.members.length === 0) {
      this.errorMessage = 'Nenhum membro rastreado. Sincronize os membros do Discord.';
      return;
    }

    this.assigning = true;
    this.errorMessage = '';
    this.successMessage = '';

    const assignments = this.members.map((member) => ({
      trackedUserId: member.id,
      categoryId: this.memberCategoryById[member.id] || null,
    }));

    this.trackedMembersService.assignCategories(assignments).subscribe({
      next: (response) => {
        this.members = response.members ?? [];
        this.memberCategoryById = Object.fromEntries(
          this.members.map((member) => [member.id, member.categoryId ?? '']),
        );
        this.assigning = false;
        this.successMessage = 'Categorias dos membros salvas com sucesso.';
      },
      error: (error) => {
        this.assigning = false;
        this.errorMessage = error.error?.error ?? 'Falha ao salvar categorias dos membros.';
      },
    });
  }

  /**
   * Cria nova categoria informada pelo usuário.
   */
  createCategory(): void {
    if (!this.createForm.name.trim()) {
      this.errorMessage = 'Informe o nome da categoria.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient
      .post<{ category: MemberCategoryDto }>(`${this.getBaseUrl()}/categories`, {
        name: this.createForm.name.trim(),
        slug: this.createForm.slug.trim() || undefined,
        color: this.createForm.color.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.createForm = this.createInitialForm();
          this.saving = false;
          this.successMessage = 'Categoria criada com sucesso.';
          this.loadCategories();
        },
        error: (error) => {
          this.saving = false;
          this.errorMessage = error.error?.error ?? 'Falha ao criar categoria.';
        },
      });
  }

  /**
   * Inicia edição de uma categoria existente.
   * @param category Categoria selecionada
   */
  startEdit(category: MemberCategoryDto): void {
    this.editingCategoryId = category._id;
    this.editForm = {
      name: category.name,
      slug: category.slug,
      color: category.color ?? '',
    };
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * Cancela edição em andamento.
   */
  cancelEdit(): void {
    this.editingCategoryId = null;
    this.editForm = this.createInitialForm();
  }

  /**
   * Persiste alterações da categoria em edição.
   */
  updateCategory(): void {
    if (!this.editingCategoryId) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient
      .put<{ category: MemberCategoryDto }>(`${this.getBaseUrl()}/categories/${this.editingCategoryId}`, {
        name: this.editForm.name.trim(),
        slug: this.editForm.slug.trim() || undefined,
        color: this.editForm.color.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.successMessage = 'Categoria atualizada com sucesso.';
          this.cancelEdit();
          this.loadCategories();
        },
        error: (error) => {
          this.saving = false;
          this.errorMessage = error.error?.error ?? 'Falha ao atualizar categoria.';
        },
      });
  }

  /**
   * Remove categoria selecionada.
   * @param categoryId ID da categoria
   */
  deleteCategory(categoryId: string): void {
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient.delete(`${this.getBaseUrl()}/categories/${categoryId}`).subscribe({
      next: () => {
        this.saving = false;
        this.successMessage = 'Categoria removida com sucesso.';
        this.loadCategories();
        this.loadMembers();
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage = error.error?.error ?? 'Falha ao remover categoria.';
      },
    });
  }

  /**
   * Monta URL base das rotas de categorias.
   */
  private getBaseUrl(): string {
    return this.tenantContext.getGuildApiBaseUrl();
  }

  /**
   * Estado inicial do formulário de categoria.
   */
  private createInitialForm(): CategoryFormModel {
    return { name: '', slug: '', color: '#3b82f6' };
  }
}
