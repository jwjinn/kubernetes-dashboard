package main

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	corelisters "k8s.io/client-go/listers/core/v1"
	"k8s.io/client-go/tools/cache"
)

type clusterCache struct {
	factory     informers.SharedInformerFactory
	nodeLister  corelisters.NodeLister
	podLister   corelisters.PodLister
	hasSynced   []cache.InformerSynced
}

func newClusterCache(ctx context.Context, client kubernetes.Interface, resyncPeriod time.Duration) (*clusterCache, error) {
	factory := informers.NewSharedInformerFactory(client, resyncPeriod)
	nodeInformer := factory.Core().V1().Nodes()
	podInformer := factory.Core().V1().Pods()

	clusterCache := &clusterCache{
		factory:    factory,
		nodeLister: nodeInformer.Lister(),
		podLister:  podInformer.Lister(),
		hasSynced: []cache.InformerSynced{
			nodeInformer.Informer().HasSynced,
			podInformer.Informer().HasSynced,
		},
	}

	factory.Start(ctx.Done())
	if !cache.WaitForCacheSync(ctx.Done(), clusterCache.hasSynced...) {
		return nil, fmt.Errorf("failed to sync node/pod informers")
	}

	return clusterCache, nil
}

func (c *clusterCache) HasSynced() bool {
	if c == nil {
		return false
	}

	for _, synced := range c.hasSynced {
		if !synced() {
			return false
		}
	}

	return true
}

func (c *clusterCache) ListNodes() ([]*corev1.Node, error) {
	return c.nodeLister.List(labels.Everything())
}

func (c *clusterCache) ListPods() ([]*corev1.Pod, error) {
	return c.podLister.List(labels.Everything())
}
