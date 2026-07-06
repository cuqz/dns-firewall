"""Run this to create the DNS Firewall VM on Oracle Cloud."""
import oci

config = oci.config.from_file()
compute = oci.core.ComputeClient(config)

with open('C:\\Users\\WezaMwiwa\\Downloads\\ssh-key-2026-07-06.key.pub') as f:
    ssh_key = f.read().strip()

subnet_id = 'ocid1.subnet.oc1.af-johannesburg-1.aaaaaaaapn27b35e6yhgf4kdok7vguacn6hfebpt75ru4rvsanzpd5ktgg3a'

instance = compute.launch_instance(oci.core.models.LaunchInstanceDetails(
    display_name='dns-firewall',
    compartment_id=config['tenancy'],
    availability_domain='idHE:AF-JOHANNESBURG-1-AD-1',
    shape='VM.Standard.A1.Flex',
    shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
        ocpus=1,
        memory_in_gbs=6
    ),
    source_details=oci.core.models.InstanceSourceViaImageDetails(
        image_id='ocid1.image.oc1.af-johannesburg-1.aaaaaaaa2ngirhwdkle6ttnioakq5m55rtjwgthtdpgoprszc3a6sv4nqw4q',
        boot_volume_size_in_gbs=200
    ),
    create_vnic_details=oci.core.models.CreateVnicDetails(
        subnet_id=subnet_id,
        assign_public_ip=True,
        display_name='vnic-dns-firewall'
    ),
    metadata={
        'ssh_authorized_keys': ssh_key
    }
)).data

print(f'Instance created!')
print(f'OCID: {instance.id}')
print(f'State: {instance.lifecycle_state}')
