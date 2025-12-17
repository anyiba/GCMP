/*---------------------------------------------------------------------------------------------
 *  DeepSeek 余额查询器
 *--------------------------------------------------------------------------------------------*/

import { IBalanceQuery, BalanceQueryResult } from '../balanceQuery';
import { StatusLogger } from '../../../utils/statusLogger';
import { ApiKeyManager } from '../../../utils/apiKeyManager';
import { Logger } from '../../../utils';

interface DeepSeekBalanceResponse {
    is_available: boolean;
    balance_infos: Array<{
        currency: string;
        total_balance: string;
        granted_balance: string;
        topped_up_balance: string;
    }>;
}

export class DeepSeekBalanceQuery implements IBalanceQuery {
    async queryBalance(providerId: string): Promise<BalanceQueryResult> {
        StatusLogger.debug(`[DeepSeekBalanceQuery] 查询提供商 ${providerId} 的余额`);

        try {
            const apiKey = await ApiKeyManager.getApiKey(providerId);

            if (!apiKey) {
                throw new Error(`未找到提供商 ${providerId} 的API密钥`);
            }

            const response = await fetch('https://api.deepseek.com/user/balance', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
            }

            const result = (await response.json()) as DeepSeekBalanceResponse;

            if (!result.is_available) {
                throw new Error('DeepSeek 账户状态不可用');
            }

            // Find CNY balance, or first available
            const balanceInfo = result.balance_infos.find(b => b.currency === 'CNY') || result.balance_infos[0];

            if (!balanceInfo) {
                 return {
                    balance: 0,
                    currency: 'CNY'
                 };
            }

            const total = parseFloat(balanceInfo.total_balance) || 0;
            const granted = parseFloat(balanceInfo.granted_balance) || 0;
            const paid = parseFloat(balanceInfo.topped_up_balance) || 0;

            StatusLogger.debug('[DeepSeekBalanceQuery] 余额查询成功');

            return {
                paid,
                granted,
                balance: total,
                currency: balanceInfo.currency
            };
        } catch (error) {
            Logger.error('[DeepSeekBalanceQuery] 查询余额失败', error);
            throw new Error(`DeepSeek 余额查询失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
}
