# block_table_no_commit_optimize 增量独立复核

审阅对象：`block-param-remediation.diff`与当前页面全文。未改该页，不替代root的16项来源账本。

本轮实际读固定39fef3f8的block_table.py339–518：构造时选类，脏范围打包、scatter、事件等待均发生在优化路径；不能由更少复制字节直接断言总会更快。读rc2 block_table.py298–303、519–521及配套vllm@ced6857a utils.py110–143，确认copy_to_gpu(n)切前n行再复制，MRv1不由已删键选路。

实际读db701c1f AscendConfig构造32–332及2c59ff10/2ed6cbba相对此构造的完整差异；此键未被读取，也无通用未知键拒收。实际读baa023ad1660–1679、7d8252291844–1912，unknown_keys仅在能找到vllm_omni时告警并过滤，否则送入配置校验。对五个固定快照的vllm_ascend目录执行git grep，该键均无命中（退出码1）；不存在结论限定固定快照，未用tag包含提交代替当前树行为。

修订中新增的版本限定、rc2拒收边界、性能条件与以上证据一致，未发现新增P1/P2。PR日期与模型性能记录本次未重复上网核验，由root逐条来源账本负责；不将本次增量接受扩大为全部来源独立复核。没有NPU性能测试。
