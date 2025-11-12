import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface BookConfig {
    filePath: string;
    fileName: string;
    progress: number; // 滚动位置（行号）
    totalLines: number;
    lastReadTime: string;
    chapterPattern?: string; // 特定于该文档的章节分割规则
    bookmarks?: number[]; // 书签（可选功能）
}

export class BookConfigManager {
    private static getConfigPath(txtFilePath: string): string {
        const dir = path.dirname(txtFilePath);
        const baseName = path.basename(txtFilePath, '.txt');
        return path.join(dir, `${baseName}.json`);
    }

    /**
     * 加载文档配置
     */
    public static async loadConfig(txtFilePath: string): Promise<BookConfig | null> {
        const configPath = this.getConfigPath(txtFilePath);
        
        try {
            if (fs.existsSync(configPath)) {
                const content = await fs.promises.readFile(configPath, 'utf-8');
                return JSON.parse(content);
            }
        } catch (error) {
            console.error('读取配置文档失败:', error);
        }
        
        return null;
    }

    /**
     * 保存文档配置
     */
    public static async saveConfig(config: BookConfig): Promise<boolean> {
        const configPath = this.getConfigPath(config.filePath);
        
        try {
            const content = JSON.stringify(config, null, 2);
            await fs.promises.writeFile(configPath, content, 'utf-8');
            return true;
        } catch (error) {
            console.error('保存配置文档失败:', error);
            vscode.window.showErrorMessage(`保存配置失败: ${error}`);
            return false;
        }
    }

    /**
     * 更新阅读进度
     */
    public static async updateProgress(
        txtFilePath: string,
        progress: number,
        totalLines: number
    ): Promise<void> {
        let config = await this.loadConfig(txtFilePath);
        
        if (!config) {
            config = {
                filePath: txtFilePath,
                fileName: path.basename(txtFilePath),
                progress: 0,
                totalLines: totalLines,
                lastReadTime: new Date().toISOString()
            };
        }
        
        config.progress = progress;
        config.totalLines = totalLines;
        config.lastReadTime = new Date().toISOString();
        
        await this.saveConfig(config);
    }

    /**
     * 更新章节分割规则
     */
    public static async updateChapterPattern(
        txtFilePath: string,
        pattern: string
    ): Promise<void> {
        let config = await this.loadConfig(txtFilePath);
        
        if (!config) {
            // 创建新配置
            const stats = await fs.promises.stat(txtFilePath);
            config = {
                filePath: txtFilePath,
                fileName: path.basename(txtFilePath),
                progress: 0,
                totalLines: 0,
                lastReadTime: new Date().toISOString()
            };
        }
        
        config.chapterPattern = pattern;
        await this.saveConfig(config);
    }

    /**
     * 获取目录下所有文档的配置
     */
    public static async getAllBooksInDirectory(dirPath: string): Promise<BookConfig[]> {
        const books: BookConfig[] = [];
        
        try {
            if (!fs.existsSync(dirPath)) {
                return books;
            }

            const files = await fs.promises.readdir(dirPath);
            
            for (const file of files) {
                if (file.endsWith('.txt')) {
                    const txtPath = path.join(dirPath, file);
                    const stats = await fs.promises.stat(txtPath);
                    
                    if (stats.isFile()) {
                        let config = await this.loadConfig(txtPath);
                        
                        if (!config) {
                            // 如果没有配置文档，创建默认配置
                            config = {
                                filePath: txtPath,
                                fileName: file,
                                progress: 0,
                                totalLines: 0,
                                lastReadTime: stats.mtime.toISOString()
                            };
                        }
                        
                        books.push(config);
                    }
                }
            }
        } catch (error) {
            console.error('读取目录失败:', error);
        }
        
        // 按最后阅读时间排序
        books.sort((a, b) => {
            return new Date(b.lastReadTime).getTime() - new Date(a.lastReadTime).getTime();
        });
        
        return books;
    }

    /**
     * 计算阅读进度百分比
     */
    public static getProgressPercentage(config: BookConfig): number {
        if (config.totalLines === 0) {
            return 0;
        }
        return Math.round((config.progress / config.totalLines) * 100);
    }

    /**
     * 格式化最后阅读时间
     */
    public static formatLastReadTime(isoString: string): string {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return '刚刚';
        } else if (diffMins < 60) {
            return `${diffMins}分钟前`;
        } else if (diffHours < 24) {
            return `${diffHours}小时前`;
        } else if (diffDays < 7) {
            return `${diffDays}天前`;
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }
}

