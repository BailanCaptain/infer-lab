# HCCL 缓冲增量独立复核

结论：接受本次增量，未发现未闭合 P1/P2。

当前页面 SHA256：`0afc38ceb6b866e0556377e2da6393e162746de4e771e9171c1c7f931643959e`。

完整读取 root-hccl-remediation.diff，复读原来源 1–8、11、14、15 和新增 32–43 的全部固定范围；另读 db701c1f 的 moe_comm_method.py 40–65、260–302 与 patch_distributed.py 180–269，以及 CANN 9.1.X HCCL_BUFFSIZE 官方缓存全文。DP=2 的 4 个 int32、启动检查先于建组、融合窗口的实际消费者、附加组条件和缓存范围均与修订一致。

最后的 P3 已关闭：source42 扩至 238–269，页末补上睡眠后重建映射，flow 图增加 238–246 固定证据；restore_hccl 实际调用 _init_device_groups(create_cpu_group=False)，与图示相符。

这是增量独立复核，不冒称另行核完全部 43 项历史来源；作者逐项判定保留 root-hccl-citations.json 原值。未做 UI、NPU、视觉或实际容量验证。
