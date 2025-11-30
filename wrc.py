import requests
import datetime
import matplotlib.pyplot as plt
import json
import numpy as np
from typing import List, Tuple, Dict
import matplotlib.dates as mdates
import os
import glob

# 核心配置
BASE_URL = "http://www.hnswkcj.com/wxhn/data/rthyinfo/rsvr/proc/one.json"
STATION_CODE = "613K0912"
STATION_NAME = "中方县铜湾水库"

# 自动清理配置
CLEANUP_ENABLE = True  # 是否开启自动清理
CLEANUP_HOURS = 24     # 清理超过24小时的图片
CLEANUP_PREFIX = f"{STATION_NAME}_水文数据_"  # 匹配要清理的图片前缀

# Matplotlib 渲染配置（中文+数学符号）
plt.rcParams["font.sans-serif"] = ["SimHei"]        # 中文黑体
plt.rcParams["axes.unicode_minus"] = False          # 负号正常显示
plt.rcParams["mathtext.fontset"] = "stix"           # 数学符号渲染
plt.rcParams["mathtext.default"] = "regular"        # 数学文本样式
plt.rcParams["figure.dpi"] = 100                    # 基础显示DPI

# 水文指标配置
INDEX_CONFIG = {
    "rz": {"name": "库内水位", "unit_math": "$m$", "color": "#1f77b4", "axis": "left"},
    "w": {"name": "蓄水量", "unit_math": "$10^6 m^3$", "color": "#ff7f0e", "axis": "right"},
    "inq": {"name": "入库流量", "unit_math": "$m^3/s$", "color": "#2ca02c", "axis": "right"},
    "otq": {"name": "出库流量", "unit_math": "$m^3/s$", "color": "#d62728", "axis": "right"}
}
# 需要过滤0值的指标（入库/出库流量）
ZERO_FILTER_INDICES = ["inq", "otq"]

# 自动清理旧图片函数
def cleanup_old_images():
    if not CLEANUP_ENABLE:
        print("自动清理功能已关闭，跳过清理")
        return
    
    # 计算清理阈值时间（当前时间 - 清理时长）
    cleanup_threshold = datetime.datetime.now() - datetime.timedelta(hours=CLEANUP_HOURS)
    print(f"\n开始清理{CLEANUP_HOURS}小时前生成的水文图片，阈值时间：{cleanup_threshold.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 匹配当前目录下符合前缀的png文件
    image_pattern = f"{CLEANUP_PREFIX}*.png"
    image_files = glob.glob(image_pattern)
    deleted_count = 0
    
    for file_path in image_files:
        try:
            # 提取文件名中的时间戳（格式：水文数据_YYYYMMDD_HHMMSS.png）
            file_name = os.path.basename(file_path)
            # 截取时间戳部分：去掉前缀和后缀
            timestamp_str = file_name.replace(CLEANUP_PREFIX, "").replace(".png", "")
            # 解析时间戳
            file_datetime = datetime.datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
            
            # 若文件生成时间早于阈值，删除
            if file_datetime < cleanup_threshold:
                os.remove(file_path)
                print(f"已删除旧图片：{file_name}")
                deleted_count += 1
        except Exception as e:
            # 跳过解析失败的文件（非脚本生成的图片）
            print(f"跳过非标准命名文件：{file_path}，错误：{str(e)}")
            continue
    
    print(f"清理完成，共删除{deleted_count}个旧图片，剩余{len(image_files)-deleted_count}个图片\n")

# 计算48小时时间范围
def get_time_range() -> Tuple[str, str]:
    now = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8)
    begin_time = now - datetime.timedelta(hours=48)
    return begin_time.strftime("%Y-%m-%d+%H"), now.strftime("%Y-%m-%d+%H")

# 生成带时间戳的文件名
def get_current_filename() -> str:
    current_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8)
    return f"{STATION_NAME}_水文数据_{current_time.strftime('%Y%m%d_%H%M%S')}.png"

# 请求API数据
def request_data(date_begin: str, date_end: str) -> dict:
    url = f"{BASE_URL}?code={STATION_CODE}&dateBegin={date_begin}&dateEnd={date_end}"
    print(f"最终请求URL: {url}")
    
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"}
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        print(f"API请求成功: 数据总数={data.get('total', 0)}, 有效记录数={len(data.get('list', []))}")
        return data
    except requests.exceptions.RequestException as e:
        raise Exception(f"API请求失败: {str(e)}, 状态码: {response.status_code if 'response' in locals() else '无'}")
    except json.JSONDecodeError as e:
        raise Exception(f"JSON解析失败: {str(e)}, 响应内容: {response.text[:500]}")

# 解析数据（处理缺失值/0值为NaN）
def parse_data(raw_data: dict) -> Tuple[List[datetime.datetime], Dict[str, List[float]]]:
    time_list, index_values = [], {k: [] for k in INDEX_CONFIG.keys()}
    data_list = raw_data.get("list", [])
    
    if not isinstance(data_list, list):
        raise Exception(f"数据格式异常: 预期列表类型, 实际为{type(data_list)}")
    
    for item in data_list:
        # 解析时间
        if not (time_str := item.get("tm")):
            print(f"跳过无效数据项: 缺失时间字段 | {item}")
            continue
        try:
            time_obj = datetime.datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
        except ValueError as e:
            print(f"时间解析失败: {time_str} | 错误: {e}")
            continue
        
        # 解析指标值（缺失值/0值设为NaN）
        temp_vals = {}
        for idx in INDEX_CONFIG.keys():
            val = item.get(idx)
            # 空值/无效值处理
            if val is None or val == "":
                temp_vals[idx] = np.nan
            else:
                try:
                    val_float = float(val)
                    # 入库/出库流量为0时，视为未获取到数据，设为NaN
                    if idx in ZERO_FILTER_INDICES and val_float == 0:
                        temp_vals[idx] = np.nan
                        print(f"过滤0值数据: 字段={idx}, 时间={time_str}, 值={val_float}")
                    else:
                        temp_vals[idx] = val_float
                except (ValueError, TypeError):
                    temp_vals[idx] = np.nan
                    print(f"数值解析失败: 字段={idx}, 值={val} | 数据项: {item}")
        
        time_list.append(time_obj)
        for idx in INDEX_CONFIG.keys():
            index_values[idx].append(temp_vals[idx])
    
    # 校验解析结果
    if not time_list:
        raise Exception("解析后无有效时间数据")
    # 移除全NaN的指标
    for idx in list(index_values.keys()):
        if all(np.isnan(x) for x in index_values[idx]):
            print(f"警告: {INDEX_CONFIG[idx]['name']}无有效数据, 跳过绘制")
            del index_values[idx], INDEX_CONFIG[idx]
    if not index_values:
        raise Exception("所有指标均无有效数据")
    
    print(f"数据解析完成: 有效时间点={len(time_list)}个, 有效指标={[INDEX_CONFIG[idx]['name'] for idx in index_values.keys()]}")
    return time_list, index_values

# 双行时间格式化器（兼容所有Matplotlib版本）
class DualLineDateFormatter:
    def __init__(self, date_fmt="%m-%d", time_fmt="%H:%M"):
        self.date_fmt = date_fmt
        self.time_fmt = time_fmt
        self.inv_converter = mdates.num2date  # 数字转日期

    def __call__(self, x, pos=0):
        try:
            dt = self.inv_converter(x)
            # 双行显示：日期换行时刻
            return f"{dt.strftime(self.date_fmt)}\n{dt.strftime(self.time_fmt)}"
        except ValueError:
            return ""

# 绘制优化后的双轴折线图
def plot_double_axis_chart(time_list: List[datetime.datetime], index_values: Dict[str, List[float]]):
    save_path = get_current_filename()
    fig, ax1 = plt.subplots(figsize=(18, 9))
    ax2 = ax1.twinx()  # 右轴（蓄水量/流量）
    
    # -------------------------- 绘制折线（缺失值/0值无标记点） --------------------------
    lines, labels = [], []
    for idx, values in index_values.items():
        cfg = INDEX_CONFIG[idx]
        ax = ax1 if cfg["axis"] == "left" else ax2
        
        # 转换为numpy数组，过滤有效数据点
        vals_np = np.array(values)
        valid_mask = ~np.isnan(vals_np)
        
        # 绘制折线（自动跳过NaN间隙）
        line = ax.plot(time_list, vals_np, linewidth=2.5, color=cfg["color"], alpha=0.8,
                       label=f"{cfg['name']} ({cfg['unit_math']})")[0]
        
        # 仅在有效数据点绘制标记（排除NaN/0值）
        if np.sum(valid_mask) > 0:
            ax.scatter(
                [time_list[i] for i in np.where(valid_mask)[0]],
                vals_np[valid_mask],
                color=cfg["color"], marker="o", s=40, edgecolors="white", linewidth=1.5,
                zorder=6  # 标记层级高于折线
            )
        
        lines.append(line)
        labels.append(f"{cfg['name']} ({cfg['unit_math']})")
    
    # -------------------------- X轴配置（底部双行时间刻度） --------------------------
    # 主刻度：每6小时一个
    ax1.xaxis.set_major_locator(mdates.HourLocator(interval=6))
    # 应用双行刻度格式器
    ax1.xaxis.set_major_formatter(DualLineDateFormatter())
    # 设置刻度文本居中
    for label in ax1.get_xticklabels():
        label.set_horizontalalignment('center')
    # 刻度样式调整
    ax1.tick_params(
        axis='x', labelsize=11, pad=8,
        length=6, width=1.2
    )
    ax1.set_xlabel("", fontsize=14)
    
    # -------------------------- 纵轴配置 --------------------------
    # 左轴（库内水位）
    left_idx = next(k for k in INDEX_CONFIG if INDEX_CONFIG[k]["axis"] == "left")
    ax1.set_ylabel(
        f"{INDEX_CONFIG[left_idx]['name']}（单位：{INDEX_CONFIG[left_idx]['unit_math']}）",
        fontsize=14, labelpad=15, color=INDEX_CONFIG[left_idx]["color"]
    )
    ax1.tick_params(axis="y", labelcolor=INDEX_CONFIG[left_idx]["color"], labelsize=11)
    ax1.grid(True, alpha=0.3, linestyle="--", zorder=0)
    
    # 右轴（蓄水量/流量）
    if any(INDEX_CONFIG[idx]["axis"] == "right" for idx in INDEX_CONFIG):
        ax2.set_ylabel(
            f"蓄水量/流量指标（单位：$10^6 m^3$ / $m^3/s$）",
            fontsize=14, labelpad=15, color="#ff7f0e"
        )
        ax2.tick_params(axis="y", labelcolor="#ff7f0e", labelsize=11)
    
    # -------------------------- 图例配置（无重叠） --------------------------
    legend = ax1.legend(
        lines, labels,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.12),
        ncol=len(lines),
        fontsize=11,
        framealpha=0.95,
        shadow=True,
        borderpad=1,
        labelspacing=1.5,
        columnspacing=2
    )
    legend.get_frame().set_linewidth(1.2)
    
    # -------------------------- 标题与布局 --------------------------
    ax1.set_title(
        f"{STATION_NAME}水文综合监测数据（站点编号：{STATION_CODE}）",
        fontsize=20, pad=25, fontweight="bold"
    )
    plt.subplots_adjust(bottom=0.2, left=0.08, right=0.92, top=0.9)
    
    # 保存高清图片
    plt.savefig(save_path, dpi=300, bbox_inches="tight", facecolor="white")
    print(f"图表已保存至：{save_path}")
    plt.show()

# 主函数
def main():
    try:
        # 第一步：执行旧图片清理
        cleanup_old_images()
        
        # 第二步：获取时间范围并请求数据
        date_begin, date_end = get_time_range()
        print(f"请求时间范围：{date_begin} 至 {date_end}")
        
        raw_data = request_data(date_begin, date_end)
        time_list, index_values = parse_data(raw_data)
        plot_double_axis_chart(time_list, index_values)
        
        print("\n脚本执行完成！")
    except Exception as e:
        print(f"\n脚本执行失败：{str(e)}")

if __name__ == "__main__":
    main()