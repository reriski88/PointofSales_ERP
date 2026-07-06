/**
 * Repository Interface: ISubscriptionRepository
 * Contract — any implementation must fulfill this.
 */
import { TenantSubscriptionEntity } from "@/backend/domain/entities/TenantSubscriptionEntity";
import { SubscriptionPlanEntity } from "@/backend/domain/entities/SubscriptionPlanEntity";

export interface ISubscriptionRepository {
  findByOrganizationId(organizationId: string): Promise<TenantSubscriptionEntity | null>;
  findPlanById(planId: string): Promise<SubscriptionPlanEntity | null>;
  findAllPlans(): Promise<SubscriptionPlanEntity[]>;
  save(subscription: TenantSubscriptionEntity): Promise<void>;
}
