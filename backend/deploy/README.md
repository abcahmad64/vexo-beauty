# VEXO production runtime foundation

This Compose definition is intentionally not started by Batch 35A foundation.
It creates a PostgreSQL 18 volume separate from the preserved PostgreSQL 16
rollback volume, reuses the existing Redis volume, keeps data services off host
ports, and binds the temporary HTTP ingress to `127.0.0.1:8080` only.

Public TLS activation remains blocked until the domain, public routing/static IP,
and certificate path are available. Database restore and controlled switchover
must be performed by the dedicated migration checkpoint.
