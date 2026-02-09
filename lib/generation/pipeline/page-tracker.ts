/**
 * Page Tracker Service (Framework Part 8.2)
 *
 * Tracks cumulative page counts per volume during generation.
 * Provides status warnings when approaching RFP page limits.
 * Integrates with ContentCondenser for automatic content reduction.
 */

import { PAGE_CONSTANTS } from '../planning/page-estimator';

/**
 * Allocation record for a single section
 */
export interface PageAllocation {
  sectionId: string;
  volumeType: string;
  content: string;
  estimatedPages: number;
  allocatedLimit?: number;
}

/**
 * Status of page tracking for a volume
 */
export interface PageLimitStatus {
  currentPages: number;
  limitPages: number | null;
  status: 'ok' | 'warning' | 'over';
  message: string;
  allocations: PageAllocation[];
}

/**
 * Result of adding a section
 */
export interface AddSectionResult {
  added: boolean;
  condensed: boolean;
  status: PageLimitStatus;
}

/**
 * Callback signature for content condensing
 * Matches condenseContent function signature from content-condenser.ts
 */
export type CondenseCallback = (
  content: string,
  targetPages: number,
  companyName: string
) => Promise<{ condensedContent: string; success: boolean }>;

/**
 * Volume limits configuration
 */
export interface VolumeLimits {
  [volumeType: string]: number | null;
}

/**
 * PageTracker - Monitors page allocation and triggers auto-condensing
 *
 * Usage:
 * ```typescript
 * const tracker = new PageTracker('Technical', 50); // 50 page limit
 * tracker.setCondenseCallback(condenseContent, 'Acme Corp');
 *
 * const result = await tracker.addSection({
 *   sectionId: 'tech-approach',
 *   volumeType: 'Technical',
 *   content: longContent,
 *   estimatedPages: 0 // Will be calculated
 * });
 *
 * if (result.condensed) {
 *   console.log('Content was auto-condensed to fit limits');
 * }
 * ```
 */
export class PageTracker {
  private volumeType: string;
  private limitPages: number | null;
  private allocations: PageAllocation[] = [];
  private condenseCallback?: CondenseCallback;
  private companyName: string = '';

  // 10% buffer for formatted content per research pitfall #4
  private static readonly FORMAT_BUFFER = 0.10;
  // 5% buffer when calculating condense target
  private static readonly CONDENSE_BUFFER = 0.05;

  constructor(volumeType: string, limitPages: number | null = null) {
    this.volumeType = volumeType;
    this.limitPages = limitPages;
  }

  /**
   * Set the condense callback for automatic content reduction
   * @param callback Function matching condenseContent signature
   * @param companyName Company name for compliance statement preservation
   */
  setCondenseCallback(callback: CondenseCallback, companyName: string): void {
    this.condenseCallback = callback;
    this.companyName = companyName;
  }

  /**
   * Get current total pages across all allocations
   */
  get currentPages(): number {
    return this.allocations.reduce((sum, alloc) => sum + alloc.estimatedPages, 0);
  }

  /**
   * Estimate pages for a given content string
   * Uses PAGE_CONSTANTS.CHARS_PER_PAGE (3000) with 10% buffer for formatting
   */
  private estimatePagesFromContent(content: string): number {
    const chars = content.length;
    // Apply 10% buffer: if content is 3000 chars, estimate ~1.1 pages
    const effectiveCharsPerPage =
      PAGE_CONSTANTS.CHARS_PER_PAGE * (1 - PageTracker.FORMAT_BUFFER);
    const rawPages = chars / effectiveCharsPerPage;
    // Round to 2 decimal places for precision
    return Math.round(rawPages * 100) / 100;
  }

  /**
   * Add a section to the tracker
   *
   * If adding would exceed limits and a condense callback is set,
   * attempts to condense the content automatically.
   *
   * @param allocation Section allocation (estimatedPages will be recalculated)
   * @returns Result with condensed flag and current status
   */
  async addSection(
    allocation: Omit<PageAllocation, 'estimatedPages'> & { estimatedPages?: number }
  ): Promise<AddSectionResult> {
    // Calculate estimated pages from content
    const estimatedPages = this.estimatePagesFromContent(allocation.content);
    const newTotal = this.currentPages + estimatedPages;

    // Check if we need to condense
    if (
      this.limitPages !== null &&
      newTotal > this.limitPages &&
      this.condenseCallback
    ) {
      // Calculate target pages (remaining space with 5% buffer)
      const remainingSpace = this.limitPages - this.currentPages;
      const targetPages = Math.floor(remainingSpace * (1 - PageTracker.CONDENSE_BUFFER));

      // Only attempt if we have positive target
      if (targetPages > 0) {
        try {
          const result = await this.condenseCallback(
            allocation.content,
            targetPages,
            this.companyName
          );

          if (result.success) {
            // Use condensed content
            const condensedPages = this.estimatePagesFromContent(result.condensedContent);
            const condensedAllocation: PageAllocation = {
              sectionId: allocation.sectionId,
              volumeType: allocation.volumeType,
              content: result.condensedContent,
              estimatedPages: condensedPages,
              allocatedLimit: allocation.allocatedLimit,
            };

            this.allocations.push(condensedAllocation);
            return {
              added: true,
              condensed: true,
              status: this.getStatus(),
            };
          }
        } catch (error) {
          // Condensing failed, fall through to add as-is
          console.warn('Content condensing failed:', error);
        }
      }
    }

    // Add as-is (even if over limit - let caller decide how to handle)
    const fullAllocation: PageAllocation = {
      sectionId: allocation.sectionId,
      volumeType: allocation.volumeType,
      content: allocation.content,
      estimatedPages: estimatedPages,
      allocatedLimit: allocation.allocatedLimit,
    };

    this.allocations.push(fullAllocation);
    return {
      added: true,
      condensed: false,
      status: this.getStatus(),
    };
  }

  /**
   * Get current page tracking status
   *
   * Status levels:
   * - 'ok': Under 90% of limit
   * - 'warning': 90-100% of limit
   * - 'over': Exceeds limit
   */
  getStatus(): PageLimitStatus {
    const current = this.currentPages;

    if (this.limitPages === null) {
      return {
        currentPages: current,
        limitPages: null,
        status: 'ok',
        message: 'No page limit specified',
        allocations: [...this.allocations],
      };
    }

    const percentUsed = (current / this.limitPages) * 100;

    let status: 'ok' | 'warning' | 'over';
    let message: string;

    if (current > this.limitPages) {
      status = 'over';
      const overage = current - this.limitPages;
      const overagePercent = (overage / this.limitPages) * 100;
      if (overagePercent < 10) {
        message = `Exceeds limit by ${overage.toFixed(1)} pages (${overagePercent.toFixed(1)}%) - minor reduction needed`;
      } else if (overagePercent < 25) {
        message = `Exceeds limit by ${overage.toFixed(1)} pages (${overagePercent.toFixed(1)}%) - moderate condensing required`;
      } else {
        message = `Exceeds limit by ${overage.toFixed(1)} pages (${overagePercent.toFixed(1)}%) - major content reduction required`;
      }
    } else if (percentUsed >= 90) {
      status = 'warning';
      const remaining = this.limitPages - current;
      message = `Approaching limit: ${remaining.toFixed(1)} pages remaining (${percentUsed.toFixed(1)}% used)`;
    } else {
      status = 'ok';
      const remaining = this.limitPages - current;
      if (remaining > this.limitPages * 0.2) {
        message = `${remaining.toFixed(1)} pages remaining - consider expanding key sections`;
      } else {
        message = `Good fit: ${remaining.toFixed(1)} pages remaining (${percentUsed.toFixed(1)}% used)`;
      }
    }

    return {
      currentPages: current,
      limitPages: this.limitPages,
      status,
      message,
      allocations: [...this.allocations],
    };
  }

  /**
   * Get allocation for a specific section
   */
  getSection(sectionId: string): PageAllocation | undefined {
    return this.allocations.find((a) => a.sectionId === sectionId);
  }

  /**
   * Remove a section allocation
   */
  removeSection(sectionId: string): boolean {
    const index = this.allocations.findIndex((a) => a.sectionId === sectionId);
    if (index >= 0) {
      this.allocations.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all allocations
   */
  clear(): void {
    this.allocations = [];
  }

  /**
   * Update the page limit
   */
  setLimit(limitPages: number | null): void {
    this.limitPages = limitPages;
  }

  /**
   * Get a summary of page allocations for reporting
   */
  getSummary(): string {
    const lines: string[] = [];
    const status = this.getStatus();

    lines.push(`PAGE TRACKING SUMMARY - ${this.volumeType.toUpperCase()}`);
    lines.push('='.repeat(60));
    lines.push('');

    for (const alloc of this.allocations) {
      lines.push(`${alloc.sectionId}: ${alloc.estimatedPages.toFixed(1)} pages`);
    }

    lines.push('');
    lines.push('-'.repeat(60));
    lines.push(`TOTAL: ${status.currentPages.toFixed(1)} pages`);

    if (status.limitPages !== null) {
      lines.push(`LIMIT: ${status.limitPages} pages`);
      const statusIcon =
        status.status === 'ok' ? '[OK]' :
        status.status === 'warning' ? '[WARNING]' : '[OVER]';
      lines.push(`STATUS: ${statusIcon} ${status.message}`);
    }

    return lines.join('\n');
  }
}

/**
 * Create multiple trackers for different volumes
 */
export function createVolumeTrackers(
  limits: VolumeLimits
): Map<string, PageTracker> {
  const trackers = new Map<string, PageTracker>();

  for (const [volumeType, limit] of Object.entries(limits)) {
    trackers.set(volumeType, new PageTracker(volumeType, limit));
  }

  return trackers;
}
